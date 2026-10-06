'use server';

import { addInsuranceProfile, deleteInsuranceProfile, isApiError, isLocale, updateInsuranceProfile, type InsuranceProfileInput, type Locale } from '@/sdk';
import type { DeleteInsuranceAction, InsuranceFormState } from '@/components/insurance/types';
import { translator } from '@/lib/i18n';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

const text = (value: FormDataEntryValue | null) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null);

/**
 * Adds or changes a profile (POST / PUT /insurance/profiles) with the customer's token. Only the fields the
 * contract knows are read from the form (`v.<name>`, photos as upload ids); the backend decides and answers
 * the page as it is now, or its reasons per field.
 */
export async function saveInsuranceProfileAction(_state: InsuranceFormState, formData: FormData): Promise<InsuranceFormState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('insuranceSignIn') };

  const ids = (name: string) => formData.getAll(`v.${name}`).filter((value): value is string => typeof value === 'string' && value !== '');
  const input: InsuranceProfileInput = {
    companyId: Number(formData.get('v.companyId')) || 0,
    name: text(formData.get('v.name')),
    nationalId: text(formData.get('v.nationalId')),
    insuranceNumber: text(formData.get('v.insuranceNumber')),
  };
  if (ids('nationalIdFiles').length) input.nationalIdFiles = ids('nationalIdFiles');
  if (ids('insuranceCardFiles').length) input.insuranceCardFiles = ids('insuranceCardFiles');
  const profileId = text(formData.get('profileId'));
  const kept = Object.fromEntries(Object.entries({ companyId: text(formData.get('v.companyId')), name: input.name }).filter((entry): entry is [string, string] => entry[1] !== null));

  try {
    const ctx = { locale, token };
    const saved = profileId ? await updateInsuranceProfile(storefrontClient(), ctx, profileId, input) : await addInsuranceProfile(storefrontClient(), ctx, input);
    return { ok: true, message: saved.message, page: saved.page };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') {
      const fieldErrors: Record<string, string> = {};
      for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
      return { ok: false, message: error.message, fieldErrors, values: kept };
    }
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('insuranceSignIn') };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message, values: kept };
    console.error('insurance save failed', error);
    return { ok: false, message: t('insuranceSaveFailed'), values: kept };
  }
}

export const deleteInsuranceProfileAction: DeleteInsuranceAction = async (rawLocale, id) => {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('insuranceSignIn') };
  try {
    const deleted = await deleteInsuranceProfile(storefrontClient(), { locale, token }, id);
    return { ok: true, message: deleted.message, page: deleted.page };
  } catch (error) {
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('insurance delete failed', error);
    return { ok: false, message: t('insuranceSaveFailed') };
  }
};
