'use server';

import { isApiError, isLocale, notifyWhenAvailable, type ApiErrorKind, type Locale } from '@/sdk';
import type { NotifyMeActionResult } from '@/components/product/NotifyMe';
import { translator } from '@/lib/i18n';
import { withShopper } from '@/lib/shopper.write';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message comes from the SDK itself (English only) rather than from the backend. */
const LOCAL_ERRORS: ApiErrorKind[] = ['network', 'invalid_response', 'unknown'];

/** Longest email address there is (RFC 5321); anything longer is not sent. */
const MAX_EMAIL = 254;

/**
 * "Tell me when it is back". The shopper session comes from `withShopper` (a guest session is
 * started on this first write when there is none). The email is sent only when the shopper typed
 * one; the backend says when it needs one (422 with `fields.email`) and when the product is in stock
 * (409 `already_available`): both are shown as the backend worded them.
 */
export async function notifyMeAction(rawLocale: Locale, productId: number, email: string | null): Promise<NotifyMeActionResult> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const t = translator(locale);
  const typed = typeof email === 'string' ? email.trim() : '';
  if (!Number.isInteger(productId) || productId <= 0 || (email !== null && typeof email !== 'string') || typed.length > MAX_EMAIL) {
    return { ok: false, message: t('productNotifyFailed') };
  }

  try {
    await withShopper(locale, (ctx) => notifyWhenAvailable(storefrontClient(), ctx, productId, typed || null));
  } catch (error) {
    if (!isApiError(error) || LOCAL_ERRORS.includes(error.kind)) {
      console.error('notify-me failed', error);
      return { ok: false, message: t('productNotifyFailed') };
    }
    const emailError = error.fieldErrors.email?.[0];
    return emailError ? { ok: false, message: error.message, emailError } : { ok: false, message: error.message };
  }
  return { ok: true, message: t('productNotifyDone') };
}
