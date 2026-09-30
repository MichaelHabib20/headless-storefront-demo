import 'server-only';
import { cache } from 'react';
import {
  getAddresses,
  getCheckoutSettings,
  getLocations,
  getOrder,
  getOrderCancellationReasons,
  getOrders,
  isApiError,
  type AddressBook,
  type CancellationReason,
  type CheckoutSettings,
  type Locale,
  type Locations,
  type Order,
  type OrdersPage,
  type ShopperContext,
  type StorefrontClient,
} from '@/sdk';
import { translator, type MessageKey } from './i18n';
import { shopperContext } from './shopper.server';
import { storefrontClient } from './storefront.server';

/**
 * Reads for the account pages (address book, orders). They need a shopper token (customer or
 * guest) and never create one: no token → `signed-out`, like a 401 from the API.
 *
 * - `ok`: the API answered
 * - `signed-out`: no token, or the API no longer accepts it → show the sign-in prompt
 * - `not-found`: 404 (an order or address that isn't this shopper's)
 * - `error`: anything else
 */
export type AccountResult<T> = { status: 'ok'; data: T } | { status: 'signed-out' } | { status: 'not-found' } | { status: 'error' };

async function personal<T>(locale: Locale, call: (client: StorefrontClient, ctx: ShopperContext) => Promise<T>): Promise<AccountResult<T>> {
  const ctx = await shopperContext(locale);
  if (!ctx.token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await call(storefrontClient(), ctx) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('account data failed to load', error);
    return { status: 'error' };
  }
}

/** Whether the visitor has a shopper token at all (pages that read nothing personal, e.g. "new address"). */
export async function hasShopperToken(locale: Locale): Promise<boolean> {
  return Boolean((await shopperContext(locale)).token);
}

/** Errors whose message is the SDK's own (English only, or not helpful): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/** What an account server action tells the shopper when the API refused or failed. */
export function failureMessage(error: unknown, locale: Locale, fallback: MessageKey): string {
  const t = translator(locale);
  if (isApiError(error) && error.kind === 'unauthenticated') return t('accountSessionExpired');
  if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return error.message; // localized by the backend
  console.error('account action failed', error);
  return t(fallback);
}

export function loadAddressBook(locale: Locale): Promise<AccountResult<AddressBook>> {
  return personal(locale, (client, ctx) => getAddresses(client, ctx));
}

export function loadOrders(locale: Locale, page: number, perPage: number): Promise<AccountResult<OrdersPage>> {
  return personal(locale, (client, ctx) => getOrders(client, ctx, { page, perPage }));
}

/** Deduplicated per request: the page and its metadata read the same order. */
export const loadOrder = cache((locale: Locale, orderId: string): Promise<AccountResult<Order>> => personal(locale, (client, ctx) => getOrder(client, ctx, orderId)));

/** The reasons for the cancel dialog, or null when they can't be loaded (the dialog then says so). */
export async function loadCancellationReasons(locale: Locale): Promise<CancellationReason[] | null> {
  const result = await personal(locale, (client, ctx) => getOrderCancellationReasons(client, ctx));
  return result.status === 'ok' ? result.data.items : null;
}

export interface AddressFormData {
  form: CheckoutSettings['addressForm'];
  locations: Locations;
}

/** How this store's address form looks and its locations (public data, no token), or null when the API failed. */
export async function loadAddressForm(locale: Locale): Promise<AddressFormData | null> {
  try {
    const client = storefrontClient();
    const [settings, locations] = await Promise.all([getCheckoutSettings(client, locale), getLocations(client, locale)]);
    return { form: settings.addressForm, locations };
  } catch (error) {
    console.error('address form failed to load', error);
    return null;
  }
}
