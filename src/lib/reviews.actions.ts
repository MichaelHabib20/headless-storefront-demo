'use server';

import { revalidatePath } from 'next/cache';
import { isApiError, isLocale, writeReview, type ApiErrorKind, type Locale } from '@/sdk';
import { translator } from './i18n';
import { withShopper } from './shopper.write';
import { storefrontClient } from './storefront.server';

/** What the review form shows after a submit: the backend's thank-you text, or why it refused. */
export type WriteReviewResult = { ok: true; message: string } | { ok: false; message: string; fieldErrors?: Record<string, string> };

export interface WriteReviewFields {
  productId: number;
  rating: number;
  comment: string;
  /** `Order.id` when the review is written from a delivered order (the backend may require it). */
  orderId?: string | null;
}

/** Errors whose message comes from the SDK itself (English only) rather than from the backend. */
const LOCAL_ERRORS: ApiErrorKind[] = ['network', 'invalid_response', 'unknown', 'server'];

const MAX_COMMENT = 2000;

/**
 * Writes a product review (from the product page or from a delivered order). Whether the shopper may
 * write one is the backend's (`ProductReviewsPage.write`, `Order.actions.canReviewProducts`); this only
 * passes the review on and reports the answer. A guest session is started on this first write when
 * the visitor has none (the backend accepts guests, like the old store).
 */
export async function writeReviewAction(rawLocale: Locale, fields: WriteReviewFields): Promise<WriteReviewResult> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const t = translator(locale);
  const comment = typeof fields?.comment === 'string' ? fields.comment.trim().slice(0, MAX_COMMENT) : '';
  const orderId = typeof fields?.orderId === 'string' && fields.orderId.length >= 1 && fields.orderId.length <= 64 ? fields.orderId : null;
  if (!Number.isInteger(fields?.productId) || fields.productId <= 0 || !Number.isInteger(fields?.rating) || fields.rating < 1 || fields.rating > 5 || !comment) {
    return { ok: false, message: t('reviewError') };
  }

  try {
    const result = await withShopper(locale, (ctx) => writeReview(storefrontClient(), ctx, { productId: fields.productId, rating: fields.rating, comment, orderId }));
    revalidatePath('/[locale]', 'layout');
    return { ok: true, message: result.message };
  } catch (error) {
    if (!isApiError(error) || LOCAL_ERRORS.includes(error.kind)) {
      console.error('write review failed', error);
      return { ok: false, message: t('reviewError') };
    }
    const fieldErrors = Object.fromEntries(Object.entries(error.fieldErrors).map(([name, messages]) => [name, messages[0]]));
    return { ok: false, message: error.message, fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined };
  }
}
