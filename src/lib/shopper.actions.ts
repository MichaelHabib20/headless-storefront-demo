'use server';

import { revalidatePath } from 'next/cache';
import {
  addToCompare,
  addToWishlist,
  isApiError,
  isLocale,
  removeFromCompare,
  removeFromWishlist,
  setCartItem,
  type ApiErrorKind,
  type Locale,
  type ShopperContext,
} from '@/sdk';
import { translator, type MessageKey } from './i18n';
import { withShopper } from './shopper.write';
import { storefrontClient } from './storefront.server';

/** What a card action tells the button: whether it worked, and a message for its status region. */
export interface ShopperActionResult {
  ok: boolean;
  message?: string;
}

type Operation = (ctx: ShopperContext) => Promise<unknown>;

/** Errors whose message comes from the SDK itself (English only) rather than from the backend. */
const LOCAL_ERRORS: ApiErrorKind[] = ['network', 'invalid_response', 'unknown'];

const isProductId = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0;
const isQuantity = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

function failure(locale: Locale, error?: unknown): ShopperActionResult {
  if (isApiError(error) && !LOCAL_ERRORS.includes(error.kind)) return { ok: false, message: error.message };
  if (error !== undefined && !isApiError(error)) console.error('shopper action failed', error);
  return { ok: false, message: translator(locale)('statusActionFailed') };
}

/**
 * Runs one shopper write: gets the shopper's token (creating the guest session on the first
 * action), calls the SDK, then revalidates the locale layout so the header counts and the
 * product cards' state are re-read from `GET /me`.
 */
async function perform(locale: Locale, operation: Operation, success: MessageKey): Promise<ShopperActionResult> {
  try {
    await withShopper(locale, operation);
  } catch (error) {
    return failure(locale, error);
  }
  revalidatePath('/[locale]', 'layout');
  return { ok: true, message: translator(locale)(success) };
}

/** Puts a product in the cart with the quantity the backend allows as a minimum (`purchase.minQuantity`). */
export async function addToCartAction(rawLocale: Locale, productId: number, quantity: number): Promise<ShopperActionResult> {
  const locale = localeOf(rawLocale);
  if (!isProductId(productId) || !isQuantity(quantity)) return failure(locale);
  return perform(locale, (ctx) => setCartItem(storefrontClient(), ctx, productId, quantity), 'statusAddedToCart');
}

/** `add: true` puts the product in the wishlist, `false` takes it out. */
export async function toggleWishlistAction(rawLocale: Locale, productId: number, add: boolean): Promise<ShopperActionResult> {
  const locale = localeOf(rawLocale);
  if (!isProductId(productId) || typeof add !== 'boolean') return failure(locale);
  return add
    ? perform(locale, (ctx) => addToWishlist(storefrontClient(), ctx, productId), 'statusAddedToWishlist')
    : perform(locale, (ctx) => removeFromWishlist(storefrontClient(), ctx, productId), 'statusRemovedFromWishlist');
}

/** `add: true` puts the product in the compare list (the backend may answer `compare_full`), `false` takes it out. */
export async function toggleCompareAction(rawLocale: Locale, productId: number, add: boolean): Promise<ShopperActionResult> {
  const locale = localeOf(rawLocale);
  if (!isProductId(productId) || typeof add !== 'boolean') return failure(locale);
  return add
    ? perform(locale, (ctx) => addToCompare(storefrontClient(), ctx, productId), 'statusAddedToCompare')
    : perform(locale, (ctx) => removeFromCompare(storefrontClient(), ctx, productId), 'statusRemovedFromCompare');
}
