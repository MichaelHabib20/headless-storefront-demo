'use server';

import { revalidatePath } from 'next/cache';
import { isApiError, isLocale, moveWishlistItemToCart, removeFromWishlist, type Locale, type ShopperContext, type StorefrontClient } from '@/sdk';
import { translator } from '@/lib/i18n';
import { ensureShopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

type Result = { ok: true } | { ok: false; message: string };

/** Errors whose (localized) backend message tells the shopper something useful. */
const SHOW_API_MESSAGE = new Set(['not_found', 'validation', 'quantity_not_allowed', 'conflict', 'rate_limited', 'unauthenticated']);

async function run(locale: unknown, productId: unknown, call: (client: StorefrontClient, ctx: ShopperContext, id: number) => Promise<unknown>): Promise<Result> {
  const lang: Locale = isLocale(locale) ? locale : 'en';
  const t = translator(lang);
  if (!isLocale(locale) || typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) {
    return { ok: false, message: t('wishlistActionError') };
  }
  try {
    await call(storefrontClient(), await ensureShopperContext(lang), productId);
  } catch (error) {
    if (isApiError(error) && SHOW_API_MESSAGE.has(error.kind)) return { ok: false, message: error.message };
    console.error('wishlist action failed', error);
    return { ok: false, message: t('wishlistActionError') };
  }
  // Every page under the locale layout: the wishlist itself and the header counts.
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}

export async function removeFromWishlistAction(locale: Locale, productId: number): Promise<Result> {
  return run(locale, productId, removeFromWishlist);
}

export async function moveWishlistItemToCartAction(locale: Locale, productId: number): Promise<Result> {
  return run(locale, productId, moveWishlistItemToCart);
}
