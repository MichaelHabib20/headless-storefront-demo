'use server';

import { randomUUID } from 'node:crypto';
import {
  checkoutSelections,
  computeCheckout,
  freshCheckout,
  isApiError,
  isCheckout,
  isLocale,
  placeOrder,
  setCheckoutContact,
  uploadFile,
  type ApiError,
  type Checkout,
  type CheckoutContactInput,
  type CheckoutSelections,
  type Locale,
  type ShopperContext,
} from '@/sdk';
import type { ComputeResult, ContactResult, PlaceOrderOutcome, PlaceOrderRequest, UploadResult } from '@/components/checkout/types';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { shopperContext } from '@/lib/shopper.server';
import { checkoutReturnUrl } from '@/lib/site.server';
import { storefrontClient } from '@/lib/storefront.server';

/*
 * Checkout server actions. The backend computes and decides everything: these only carry the
 * shopper's choices to it and its answer back. Arguments come from the browser, so they are
 * checked here; business rules are the backend's.
 *
 * Checkout never starts a guest session: a shopper who has a cart already has a token.
 */

/** Computes the checkout again for the shopper's choices. Never writes. */
export async function computeCheckoutAction(locale: Locale, selections: CheckoutSelections): Promise<ComputeResult> {
  const safe = safeLocale(locale);
  const ctx = await currentShopper(safe);
  if (!ctx) return { ok: false, message: translator(safe)('checkoutErrorSession') };
  try {
    return { ok: true, checkout: await computeCheckout(storefrontClient(), ctx, cleanSelections(selections)) };
  } catch (error) {
    return { ok: false, message: errorMessage(error, safe, 'checkoutErrorGeneric') };
  }
}

/** Saves a guest's contact details, then computes the checkout again (it now carries the contact). */
export async function saveContactAction(locale: Locale, contact: CheckoutContactInput, selections: CheckoutSelections): Promise<ContactResult> {
  const safe = safeLocale(locale);
  const ctx = await currentShopper(safe);
  if (!ctx) return { ok: false, message: translator(safe)('checkoutErrorSession') };
  const email = text(contact?.email);
  const input: CheckoutContactInput = { firstName: text(contact?.firstName), lastName: text(contact?.lastName), phone: text(contact?.phone), email: email || null };
  try {
    await setCheckoutContact(storefrontClient(), ctx, input);
    return { ok: true, checkout: await computeCheckout(storefrontClient(), ctx, cleanSelections(selections)) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation' && Object.keys(error.fieldErrors).length) {
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[field] = messages[0];
      return { ok: false, fieldErrors };
    }
    return { ok: false, message: errorMessage(error, safe, 'checkoutErrorGeneric') };
  }
}

/** Uploads one prescription file. The page then sends its id with the choices. */
export async function uploadPrescriptionAction(locale: Locale, form: FormData): Promise<UploadResult> {
  const safe = safeLocale(locale);
  const t = translator(safe);
  const ctx = await currentShopper(safe);
  if (!ctx) return { ok: false, message: t('checkoutErrorSession') };
  const file = form instanceof FormData ? form.get('file') : null;
  if (!(file instanceof File) || !file.name) return { ok: false, message: t('checkoutErrorUpload') };
  try {
    return { ok: true, file: await uploadFile(storefrontClient(), ctx, file, file.name) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') return { ok: false, message: error.fieldErrors.file?.[0] ?? error.message };
    return { ok: false, message: errorMessage(error, safe, 'checkoutErrorUpload') };
  }
}

/**
 * Places the order for the checkout the shopper is looking at — the ONLY place that does.
 *
 * The browser sends back that checkout as one piece; the SDK builds the request from it (its
 * choices, and its total as `expectedTotal`), so the backend can refuse the order when the total
 * it computes is not the one that was on screen. Nothing here picks, adds up or compares a price.
 *
 * - done → `url` is our result page; redirect → `url` is the payment page (http/https only).
 * - `total_changed`, `checkout_incomplete`, `payment_change_needs_consent` → the fresh checkout
 *   comes back with the message: the page shows it and the shopper confirms again.
 * - Every other refusal → the message; the shopper stays on the page. Nothing is retried here.
 */
export async function placeOrderAction(locale: Locale, request: PlaceOrderRequest): Promise<PlaceOrderOutcome> {
  const safe = safeLocale(locale);
  const t = translator(safe);
  const attemptKey = typeof request?.attemptKey === 'string' && /^[\w-]{8,100}$/.test(request.attemptKey) ? request.attemptKey : randomUUID();
  const checkout: unknown = request?.checkout;

  if (!isCheckout(checkout)) return { ok: false, message: t('checkoutErrorPlace'), attemptKey };
  if (request.acceptTerms !== true) return { ok: false, message: t('checkoutErrorTerms'), attemptKey };
  // The backend's switch. It refuses such an order anyway (`checkout_incomplete`).
  if (checkout.canPlaceOrder !== true) return { ok: false, message: t('checkoutErrorNotReady'), attemptKey };
  const ctx = await currentShopper(safe);
  if (!ctx) return { ok: false, message: t('checkoutErrorSession'), attemptKey };

  let next;
  try {
    ({ next } = await placeOrder(storefrontClient(), ctx, {
      checkout,
      acceptTerms: true,
      returnUrl: await checkoutReturnUrl(safe),
      idempotencyKey: attemptKey,
      note: typeof request.note === 'string' ? request.note : null,
      acceptPaymentChange: request.acceptPaymentChange === true,
    }));
  } catch (error) {
    return refusal(error, safe, ctx, checkout, attemptKey);
  }

  if (next.type === 'redirect') {
    if (next.url && /^https?:\/\//i.test(next.url)) return { ok: true, url: next.url };
    console.error('place order: the payment URL is not an http(s) URL');
    return { ok: false, message: t('checkoutErrorPayment'), attemptKey: randomUUID() };
  }
  // The result page asks the backend what happened; it loads fresh, so the header cart count is too.
  return { ok: true, url: routes.checkoutResult(safe, next.reference) };
}

/** What a failed `placeOrder` tells the page. */
async function refusal(error: unknown, locale: Locale, ctx: ShopperContext, shown: Checkout, attemptKey: string): Promise<PlaceOrderOutcome> {
  const t = translator(locale);
  if (!isApiError(error)) {
    console.error('place order failed', error);
    return { ok: false, message: t('checkoutErrorPlace'), attemptKey };
  }
  switch (error.kind) {
    case 'total_changed':
    case 'checkout_incomplete':
    case 'payment_change_needs_consent':
      return {
        ok: false,
        message: error.message,
        checkout: freshCheckout(error) ?? (await recompute(ctx, shown)),
        needsConsent: error.kind === 'payment_change_needs_consent',
        attemptKey: randomUUID(),
      };
    case 'order_in_progress':
      // The first request may still go through: a retry must be the same attempt.
      return { ok: false, message: error.message, attemptKey };
    case 'unauthenticated':
      return { ok: false, message: t('checkoutErrorSession'), attemptKey: randomUUID() };
    case 'validation':
      return { ok: false, message: firstFieldError(error) ?? error.message, attemptKey: randomUUID() };
    case 'payment_provider_error':
    case 'guest_checkout_disabled':
    case 'rate_limited':
    case 'conflict':
    case 'not_found':
      // Localized by the backend.
      return { ok: false, message: error.message, attemptKey: randomUUID() };
    default:
      // network / server / unreadable answer: we don't know whether the order exists. Keeping the
      // key makes the shopper's next click a retry of this attempt, never a second order.
      console.error('place order failed', error);
      return { ok: false, message: t('checkoutErrorPlace'), attemptKey };
  }
}

/** A refusal should carry the fresh checkout; when it doesn't, ask for it. */
async function recompute(ctx: ShopperContext, shown: Checkout): Promise<Checkout | undefined> {
  try {
    return await computeCheckout(storefrontClient(), ctx, checkoutSelections(shown));
  } catch (error) {
    console.error('checkout could not be computed again', error);
    return undefined;
  }
}

async function currentShopper(locale: Locale): Promise<ShopperContext | null> {
  const ctx = await shopperContext(locale);
  return ctx.token ? ctx : null;
}

function errorMessage(error: unknown, locale: Locale, fallback: 'checkoutErrorGeneric' | 'checkoutErrorUpload'): string {
  const t = translator(locale);
  if (!isApiError(error)) {
    console.error('checkout action failed', error);
    return t(fallback);
  }
  switch (error.kind) {
    case 'unauthenticated':
      return t('checkoutErrorSession');
    case 'validation':
      return firstFieldError(error) ?? error.message;
    case 'phone_in_use':
    case 'guest_checkout_disabled':
    case 'rate_limited':
    case 'conflict':
    case 'not_found':
      // Localized by the backend.
      return error.message;
    default:
      // network / server / invalid response: the SDK's fallback text is not localized.
      console.error('checkout action failed', error);
      return t(fallback);
  }
}

function firstFieldError(error: ApiError): string | undefined {
  return Object.values(error.fieldErrors).find((messages) => messages[0])?.[0];
}

/** Only the choices the contract knows, with the right types (the input comes from the browser). */
function cleanSelections(input: unknown): CheckoutSelections {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const id = (value: unknown) => (typeof value === 'number' && Number.isInteger(value) ? value : null);
  const selections: CheckoutSelections = {
    // passed on as it is: the backend knows its own fulfilment types (the contract only grows)
    fulfilment: typeof raw.fulfilment === 'string' && raw.fulfilment.length <= 40 ? (raw.fulfilment as CheckoutSelections['fulfilment']) : null,
    addressId: id(raw.addressId),
    branchId: id(raw.branchId),
    paymentMethodId: id(raw.paymentMethodId),
    installmentPlanId: id(raw.installmentPlanId),
    promoCode: text(raw.promoCode) || null,
    note: text(raw.note) || null,
    prescriptionFiles: Array.isArray(raw.prescriptionFiles) ? raw.prescriptionFiles.filter((file): file is string => typeof file === 'string') : [],
  };
  if (raw.acceptPaymentChange === true) selections.acceptPaymentChange = true;
  return selections;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function safeLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}
