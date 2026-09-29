'use server';

import { revalidatePath } from 'next/cache';
import { isApiError, isLocale, removeFromCompare, type Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { ensureShopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

type Result = { ok: true } | { ok: false; message: string };

/** Errors whose (localized) backend message tells the shopper something useful. */
const SHOW_API_MESSAGE = new Set(['not_found', 'validation', 'conflict', 'rate_limited', 'unauthenticated']);

export async function removeFromCompareAction(locale: Locale, productId: number): Promise<Result> {
  const lang: Locale = isLocale(locale) ? locale : 'en';
  const t = translator(lang);
  if (!isLocale(locale) || typeof productId !== 'number' || !Number.isInteger(productId) || productId < 1) {
    return { ok: false, message: t('compareActionError') };
  }
  try {
    await removeFromCompare(storefrontClient(), await ensureShopperContext(lang), productId);
  } catch (error) {
    if (isApiError(error) && SHOW_API_MESSAGE.has(error.kind)) return { ok: false, message: error.message };
    console.error('compare action failed', error);
    return { ok: false, message: t('compareActionError') };
  }
  // Every page under the locale layout: the comparison itself and the header counts.
  revalidatePath('/[locale]', 'layout');
  return { ok: true };
}
