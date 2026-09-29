'use server';

import { revalidatePath } from 'next/cache';
import {
  clearCart as clearCartRequest,
  isApiError,
  isLocale,
  removeCartItem,
  setCartItem,
  type Cart,
  type Locale,
  type ShopperContext,
} from '@/sdk';
import type { CartActionResult } from '@/components/cart/types';
import { translator } from '@/lib/i18n';
import { ensureShopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

/*
 * Cart writes. Each returns the cart the API answered with (totals and checkout rules
 * included) so the page never has to compute them. Arguments come from the browser:
 * they are checked here, and the backend validates quantities against its own rules.
 */

export async function setQuantity(locale: Locale, productId: number, quantity: number): Promise<CartActionResult> {
  if (!isProductId(productId) || typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) return invalid(locale);
  return write(locale, (ctx) => setCartItem(storefrontClient(), ctx, productId, quantity));
}

export async function removeItem(locale: Locale, productId: number): Promise<CartActionResult> {
  if (!isProductId(productId)) return invalid(locale);
  return write(locale, (ctx) => removeCartItem(storefrontClient(), ctx, productId));
}

export async function clearCart(locale: Locale): Promise<CartActionResult> {
  return write(locale, (ctx) => clearCartRequest(storefrontClient(), ctx));
}

async function write(requested: unknown, call: (ctx: ShopperContext) => Promise<Cart>): Promise<CartActionResult> {
  const locale = safeLocale(requested);
  try {
    const cart = await call(await ensureShopperContext(locale));
    // Header badges (cart count) are rendered by the layout: refresh every page under it.
    revalidatePath('/[locale]', 'layout');
    return { ok: true, cart };
  } catch (error) {
    return { ok: false, message: errorMessage(error, locale) };
  }
}

function errorMessage(error: unknown, locale: Locale): string {
  const t = translator(locale);
  if (!isApiError(error)) {
    console.error('cart update failed', error);
    return t('cartErrorGeneric');
  }
  switch (error.kind) {
    case 'unauthenticated':
      return t('cartErrorSession');
    case 'validation':
    case 'quantity_not_allowed':
    case 'not_found':
    case 'rate_limited':
      // Localized by the backend.
      return error.fieldErrors.quantity?.[0] ?? error.message;
    default:
      // network / server / invalid response: the SDK's fallback text is not localized.
      console.error('cart update failed', error);
      return t('cartErrorGeneric');
  }
}

function invalid(locale: unknown): CartActionResult {
  return { ok: false, message: translator(safeLocale(locale))('cartErrorGeneric') };
}

function safeLocale(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

function isProductId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
