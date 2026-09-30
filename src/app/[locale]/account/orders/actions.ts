'use server';

import { revalidatePath } from 'next/cache';
import { cancelOrder, isLocale, reorder, type Locale } from '@/sdk';
import type { CancelOrderResult, ReorderActionResult } from '@/components/account/types';
import { failureMessage } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { withShopper } from '@/lib/shopper.write';
import { storefrontClient } from '@/lib/storefront.server';

/*
 * Order writes. Whether an order can be cancelled or ordered again is the backend's decision
 * (`order.actions`); these actions only pass the shopper's request on and report the answer.
 */

/**
 * Cancels an order. Success or not (e.g. 409 `cannot_cancel`: the order moved on meanwhile), the
 * page is refreshed so it shows the order as the API now has it, and the message is announced.
 */
export async function cancelOrderAction(locale: Locale, orderId: string, reasonId: number, note: string | null): Promise<CancelOrderResult> {
  const lang = localeOf(locale);
  const t = translator(lang);
  if (!isOrderId(orderId) || !Number.isSafeInteger(reasonId) || reasonId < 1 || (note !== null && typeof note !== 'string')) {
    return { ok: false, message: t('orderActionError') };
  }
  try {
    await withShopper(lang, (ctx) => cancelOrder(storefrontClient(), ctx, orderId, { reasonId, note: note?.trim().slice(0, 500) || null }));
    return { ok: true, message: t('orderCancelled') };
  } catch (error) {
    return { ok: false, message: failureMessage(error, lang, 'orderActionError') };
  } finally {
    revalidatePath('/[locale]', 'layout');
  }
}

/** Puts the order's items in the cart again; answers what the API skipped. The header cart count is re-read. */
export async function reorderAction(locale: Locale, orderId: string): Promise<ReorderActionResult> {
  const lang = localeOf(locale);
  if (!isOrderId(orderId)) return { ok: false, message: translator(lang)('orderActionError') };
  try {
    const result = await withShopper(lang, (ctx) => reorder(storefrontClient(), ctx, orderId));
    revalidatePath('/[locale]', 'layout');
    return { ok: true, skipped: result.skipped };
  } catch (error) {
    return { ok: false, message: failureMessage(error, lang, 'orderActionError') };
  }
}

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/** The contract's `OrderId`: 1–64 characters. */
function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64;
}
