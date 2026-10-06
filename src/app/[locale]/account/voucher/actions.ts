'use server';

import { addVoucher, isApiError, isLocale, type Locale } from '@/sdk';
import type { AddVoucherResult } from '@/components/vouchers/types';
import { translator } from '@/lib/i18n';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/**
 * Adds a voucher code (POST /vouchers) with the customer's token. The backend decides whether the
 * code can be added and says why not (`fields.code`); its answer is shown as it is.
 */
export async function addVoucherAction(rawLocale: Locale, code: string): Promise<AddVoucherResult> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('vouchersSignIn') };
  try {
    const added = await addVoucher(storefrontClient(), { locale, token }, typeof code === 'string' ? code : '');
    return { ok: true, message: added.message, vouchers: added.vouchers };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('vouchersSignIn') };
    if (isApiError(error) && error.fieldErrors.code?.[0]) return { ok: false, message: error.fieldErrors.code[0] };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('add voucher failed', error);
    return { ok: false, message: t('vouchersAddFailed') };
  }
}
