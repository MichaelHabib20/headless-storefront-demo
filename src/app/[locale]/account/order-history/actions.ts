'use server';

import { revalidatePath } from 'next/cache';
import { cancelOrder, isLocale, rateOrder, reorder, type Locale, type RateOrderInput } from '@/sdk';
import type { CancelOrderResult, RateOrderResult, ReorderActionResult } from '@/components/account/types';
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

/**
 * Rates a delivered order (only while `order.actions.canRate`; the dialog's fields come from
 * `order.ratingForm`). Success or a refusal (409 `already_rated` / `cannot_rate`), the page is
 * refreshed so it shows the order — and its rating — as the API now has it.
 */
export async function rateOrderAction(locale: Locale, orderId: string, input: RateOrderInput): Promise<RateOrderResult> {
  const lang = localeOf(locale);
  const t = translator(lang);
  if (!isOrderId(orderId) || !isRating(input)) return { ok: false, message: t('orderRateError') };
  const clean: RateOrderInput = {
    rating: input.skip ? null : input.rating ?? null,
    driverRating: input.skip ? null : input.driverRating ?? null,
    feedback: typeof input.feedback === 'string' && input.feedback.trim() ? input.feedback.trim().slice(0, 1000) : null,
    skip: Boolean(input.skip),
    items: (input.items ?? []).map((item) => ({ productId: item.productId, rating: item.rating, comment: typeof item.comment === 'string' && item.comment.trim() ? item.comment.trim().slice(0, 1000) : null })),
  };
  try {
    await withShopper(lang, (ctx) => rateOrder(storefrontClient(), ctx, orderId, clean));
    return { ok: true, message: clean.skip ? '' : t('orderRateDone') };
  } catch (error) {
    return { ok: false, message: failureMessage(error, lang, 'orderRateError') };
  } finally {
    revalidatePath('/[locale]', 'layout');
  }
}

const isStars = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5;

/** Shape check only; the rules (which fields exist, which are required) are the backend's. */
function isRating(input: unknown): input is RateOrderInput {
  if (!input || typeof input !== 'object') return false;
  const value = input as RateOrderInput;
  if (!value.skip && !isStars(value.rating)) return false;
  if (value.driverRating != null && !isStars(value.driverRating)) return false;
  if (value.items !== undefined && (!Array.isArray(value.items) || value.items.length > 100)) return false;
  return (value.items ?? []).every((item) => item && Number.isInteger(item.productId) && item.productId > 0 && isStars(item.rating));
}

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/** The contract's `OrderId`: 1–64 characters. */
function isOrderId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 64;
}
