/**
 * Checkout endpoints (contract: contract/openapi.yaml, "Checkout" in the description).
 *
 * The backend computes the checkout: the storefront sends the shopper's choices and no prices,
 * and draws the `Checkout` that comes back. That answer echoes the choices it used, so the
 * answer on screen IS the state: `checkoutSelections()` reads the choices back from it, and
 * `placeOrder()` builds the order request from it, including the total the shopper saw.
 */
import { ApiError } from '../errors';
import type { operations } from '../generated/api';
import type { StorefrontClient } from './http';
import type { Checkout, CheckoutContact, CheckoutResult, CheckoutSelections, Locale, PickupBranch, PlaceOrderResult, UploadedFile } from './types';

interface Ctx {
  locale: Locale;
  token: string | null;
}

/** What a guest fills in to check out without an account. */
export type CheckoutContactInput = operations['setCheckoutContact']['requestBody']['content']['application/json'];

/** What the shopper adds to the choices when placing the order. */
export interface PlaceOrderInput {
  /** The checkout the shopper is looking at, exactly as the API answered it. */
  checkout: Checkout;
  /** Ticked by the shopper. The backend refuses the order without it. */
  acceptTerms: boolean;
  /** This storefront's result page (absolute URL). Online payments come back to it with `?checkout=<reference>`. */
  returnUrl: string | null;
  /** One key per attempt: a retry with the same key gets the first answer instead of a second order. */
  idempotencyKey: string;
  /** The shopper's order note (the checkout answer does not echo it). */
  note?: string | null;
  /** True after the shopper accepted a `payment_change_needs_consent` answer. */
  acceptPaymentChange?: boolean;
}

/**
 * Computes the checkout for the shopper's choices. Never writes: call it after every change.
 * Without choices the backend may preselect (default address, the only payment method...).
 */
export const computeCheckout = (client: StorefrontClient, ctx: Ctx, selections: CheckoutSelections = {}) =>
  client.request<Checkout>('POST', 'checkout', { ...ctx, body: selections });

/**
 * The choices a checkout answer was computed for, read from its echo. Change one of them and
 * send the result to `computeCheckout()`; never keep a second copy of the choices.
 */
export function checkoutSelections(checkout: Checkout): CheckoutSelections {
  return {
    fulfilment: checkout.fulfilment.selected,
    addressId: checkout.fulfilment.addressId,
    branchId: checkout.fulfilment.branch?.id ?? null,
    paymentMethodId: checkout.payment.selected?.methodId ?? null,
    installmentPlanId: checkout.payment.selected?.planId ?? null,
    promoCode: checkout.promo.code,
    prescriptionFiles: checkout.requirements.prescription.files.map((file) => file.id),
    useWallet: checkout.wallet?.selected ?? false,
  };
}

/**
 * Places the order for the checkout the shopper saw. The request is built here, from that one
 * checkout: its choices and its total (`expectedTotal`, passed through untouched — the backend
 * refuses the order when its own total differs). Callers can't send another total.
 *
 * Errors (`ApiError.kind`): `total_changed`, `checkout_incomplete` and
 * `payment_change_needs_consent` carry the fresh checkout (`freshCheckout(error)`);
 * `order_in_progress`, `payment_provider_error`, `guest_checkout_disabled`, `validation`.
 */
export function placeOrder(client: StorefrontClient, ctx: Ctx, input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { checkout } = input;
  const selections: CheckoutSelections = { ...checkoutSelections(checkout), note: input.note?.trim() || null };
  if (input.acceptPaymentChange) selections.acceptPaymentChange = true;
  return client.request<PlaceOrderResult>('POST', 'orders', {
    ...ctx,
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: {
      selections,
      expectedTotal: checkout.totals.total.amount,
      acceptTerms: input.acceptTerms,
      returnUrl: input.returnUrl,
    },
  });
}

/** The fresh checkout the backend sends with `total_changed`, `checkout_incomplete` and `payment_change_needs_consent`. */
export function freshCheckout(error: ApiError): Checkout | null {
  const { checkout } = error.details;
  return isCheckout(checkout) ? checkout : null;
}

/**
 * True when a value has the parts of a `Checkout` the order request is built from. Server
 * actions use it on what the browser sends back (the checkout on screen).
 */
export function isCheckout(value: unknown): value is Checkout {
  if (!isRecord(value)) return false;
  const { fulfilment, payment, promo, requirements, totals } = value;
  if (!isRecord(fulfilment) || !isRecord(payment) || !isRecord(promo) || !isRecord(requirements) || !isRecord(totals)) return false;
  const prescription = requirements.prescription;
  return isRecord(totals.total) && typeof totals.total.amount === 'number' && isRecord(prescription) && Array.isArray(prescription.files);
}

/** The real state of an order or payment. `reference` is `next.reference` or the `checkout` parameter of the return URL. */
export const getCheckoutResult = (client: StorefrontClient, ctx: Ctx, reference: string) =>
  client.request<CheckoutResult>('GET', 'checkout/result', { ...ctx, query: { ref: reference } });

/** Saves the contact details of a guest who checks out without an account. */
export const setCheckoutContact = (client: StorefrontClient, ctx: Ctx, contact: CheckoutContactInput) =>
  client.request<CheckoutContact>('PUT', 'checkout/contact', { ...ctx, body: contact });

/** Branches where the order can be collected (empty when the store has no pickup). */
export const getPickupBranches = async (client: StorefrontClient, ctx: Ctx): Promise<PickupBranch[]> =>
  (await client.request<{ items: PickupBranch[] }>('GET', 'pickup-branches', ctx)).items;

/** Uploads a prescription file (jpg, png, webp or pdf). The returned id goes in `prescriptionFiles`. */
export function uploadFile(client: StorefrontClient, ctx: Ctx, file: Blob, name?: string): Promise<UploadedFile> {
  const form = new FormData();
  if (name === undefined) form.append('file', file);
  else form.append('file', file, name);
  return client.upload<UploadedFile>('uploads', { ...ctx, form });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
