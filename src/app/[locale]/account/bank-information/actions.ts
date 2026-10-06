'use server';

import { isApiError, isLocale, saveBankDetails, type BankDetailsInput, type Locale } from '@/sdk';
import type { BankDetailsState } from '@/components/bank-details/BankDetailsView';
import { translator } from '@/lib/i18n';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/** The contract's fields only, read from the form (`v.<name>`); empty ones are not sent. */
const FIELDS = ['preferredMethod', 'fullName', 'bankName', 'iban', 'swiftCode', 'nationalId'] as const;

/** Saves the refund bank details (PUT /account/bank-details) with the customer's token; the backend decides. */
export async function saveBankDetailsAction(_state: BankDetailsState, formData: FormData): Promise<BankDetailsState> {
  const raw = formData.get('locale');
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('bankDetailsSignIn') };

  const input: BankDetailsInput = {};
  for (const name of FIELDS) {
    const value = formData.get(`v.${name}`);
    if (typeof value === 'string' && value.trim() !== '') input[name] = value.trim();
  }
  try {
    const saved = await saveBankDetails(storefrontClient(), { locale, token }, input);
    return { ok: true, message: saved.message, details: saved.details };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') {
      const fieldErrors: Record<string, string> = {};
      for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
      return { ok: false, message: error.message, fieldErrors };
    }
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('bankDetailsSignIn') };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('bank details save failed', error);
    return { ok: false, message: t('insuranceSaveFailed') };
  }
}
