'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import {
  addToCompare,
  addToWishlist,
  getMe,
  isApiError,
  isLocale,
  removeFromCompare,
  removeFromWishlist,
  setCartItem,
  type ApiErrorKind,
  type Locale,
  type Me,
  type ShopperContext,
} from '@/sdk';
import { translator, type MessageKey } from './i18n';
import { trackServerEvent } from './marketing.server';
import { shopperToken } from './shopper.server';
import { withShopper } from './shopper.write';
import { storefrontClient } from './storefront.server';

/** What a card action tells the button: whether it worked, and a message for its status region. */
export interface ShopperActionResult {
  ok: boolean;
  message?: string;
  /** Add to cart: `GET /me` read right after the write (null when it could not be read). */
  me?: Me | null;
  /**
   * Add to cart: this answer already carries the re-rendered page, because the action started the
   * guest session (Next re-renders the page when an action sets a cookie): no refresh needed after it.
   */
  rendered?: boolean;
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

/**
 * Puts a product in the cart with the quantity the backend allows as a minimum (`purchase.minQuantity`).
 * No layout revalidation here: that re-rendered the whole page inside this answer (seconds on a
 * product page). The answer carries `GET /me` read after the write instead; the shell shows its counts
 * at once and refreshes the page in the background (ShopperStateProvider.cartChanged). The visitor's
 * first write starts the guest session: setting that cookie makes Next re-render the page in this
 * answer anyway (`rendered`); the result still arrives before that render (the toast doesn't wait).
 */
export async function addToCartAction(rawLocale: Locale, productId: number, quantity: number): Promise<ShopperActionResult> {
  const locale = localeOf(rawLocale);
  if (!isProductId(productId) || !isQuantity(quantity)) return failure(locale);
  const startsSession = !(await shopperToken());
  let me: Me | null;
  try {
    me = await withShopper(locale, async (ctx) => {
      await setCartItem(storefrontClient(), ctx, productId, quantity);
      // Never fails the write (and is never retried as one): without it the background refresh brings the counts.
      return getMe(storefrontClient(), ctx).catch((error: unknown) => {
        console.error('me failed to load after add to cart', error);
        return null;
      });
    });
  } catch (error) {
    return failure(locale, error);
  }
  return tracked(locale, 'add_to_cart', productId, { ok: true, message: translator(locale)('statusAddedToCart'), me, ...(startsSession ? { rendered: true } : {}) });
}

/** After a successful write: the server-side marketing event (POST /events), sent after the answer; never fails the action. */
async function tracked(locale: Locale, name: 'add_to_cart' | 'add_to_wishlist', productId: number, result: ShopperActionResult): Promise<ShopperActionResult> {
  if (result.ok) after(() => trackServerEvent(locale, { name, productIds: [productId] }));
  return result;
}

/** `add: true` puts the product in the wishlist, `false` takes it out. */
export async function toggleWishlistAction(rawLocale: Locale, productId: number, add: boolean): Promise<ShopperActionResult> {
  const locale = localeOf(rawLocale);
  if (!isProductId(productId) || typeof add !== 'boolean') return failure(locale);
  return add
    ? tracked(locale, 'add_to_wishlist', productId, await perform(locale, (ctx) => addToWishlist(storefrontClient(), ctx, productId), 'statusAddedToWishlist'))
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
