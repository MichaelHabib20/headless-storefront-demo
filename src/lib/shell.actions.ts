'use server';

import { revalidatePath } from 'next/cache';
import { getCart, isApiError, isLocale, setArea, type Cart, type Locale } from '@/sdk';
import { translator } from './i18n';
import { shopperContext } from './shopper.server';
import { withShopper } from './shopper.write';
import { storefrontClient } from './storefront.server';

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/** What the mini cart shows: the cart as `GET /cart` answers it, no cart (no session yet), or a failure. */
export type MiniCartResult = { status: 'ok'; cart: Cart } | { status: 'none' } | { status: 'error' };

/**
 * Reads the shopper's cart for the mini cart drawer. A read: it never creates a guest session (no
 * token → `none`) and changes nothing. Everything shown (lines, totals, blockers, whether checkout
 * is allowed) is the API's answer.
 */
export async function readMiniCart(rawLocale: Locale): Promise<MiniCartResult> {
  const locale = localeOf(rawLocale);
  const ctx = await shopperContext(locale);
  if (!ctx.token) return { status: 'none' };
  try {
    return { status: 'ok', cart: await getCart(storefrontClient(), ctx) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'none' };
    console.error('mini cart failed to load', error);
    return { status: 'error' };
  }
}

export type AreaResult = { ok: true } | { ok: false; message: string };

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/**
 * Saves the shopper's area (`PUT /me/area`), on the shopper's click. A visitor without a session gets
 * one now (a write). The layout is re-read so prices and `Me.area` follow the new area.
 */
export async function chooseAreaAction(rawLocale: Locale, areaId: number): Promise<AreaResult> {
  const locale = localeOf(rawLocale);
  const t = translator(locale);
  if (typeof areaId !== 'number' || !Number.isSafeInteger(areaId) || areaId < 1) return { ok: false, message: t('areaSaveError') };
  try {
    await withShopper(locale, (ctx) => setArea(storefrontClient(), ctx, areaId));
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') return { ok: false, message: Object.values(error.fieldErrors)[0]?.[0] ?? error.message };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('area could not be saved', error);
    return { ok: false, message: t('areaSaveError') };
  }
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
