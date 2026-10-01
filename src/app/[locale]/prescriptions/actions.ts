'use server';

import { revalidatePath } from 'next/cache';
import { cancelPrescription, isApiError, isLocale, sendPrescription, uploadFile, type Locale } from '@/sdk';
import type { CancelOrderResult } from '@/components/account/types';
import type { PrescriptionFormState } from '@/components/prescriptions/types';
import { translator } from '@/lib/i18n';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

function id(value: FormDataEntryValue | null): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function text(value: FormDataEntryValue | null): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Sends the prescription (POST /prescriptions) with the customer's token. The fields are the ones the
 * form describes (`v.<name>`), the address is the chosen one; the backend validates everything and
 * its messages are shown by field. A guest is never created here.
 */
export async function sendPrescriptionAction(_state: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const locale = localeOf(formData.get('locale'));
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('prescriptionsSignIn') };

  const values = {
    type: text(formData.get('v.type')),
    prescriptionNumber: text(formData.get('v.prescriptionNumber')),
    note: text(formData.get('v.note')),
  };
  try {
    const sent = await sendPrescription(storefrontClient(), { locale, token }, {
      addressId: id(formData.get('addressId')) ?? 0,
      files: formData.getAll('v.files').filter((value): value is string => typeof value === 'string' && value !== ''),
      ...(values.type ? { type: values.type } : {}),
      prescriptionNumber: values.prescriptionNumber,
      note: values.note,
    });
    revalidatePath('/[locale]/prescriptions', 'page');
    return { ok: true, message: sent.message, sentId: sent.prescription.id };
  } catch (error) {
    // what the customer typed comes back (never the file ids: files are chosen again)
    const kept = Object.fromEntries(Object.entries(values).filter((entry): entry is [string, string] => entry[1] !== null));
    if (isApiError(error) && error.kind === 'validation') {
      const fieldErrors: Record<string, string> = {};
      for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
      return { ok: false, message: error.message, fieldErrors, values: kept };
    }
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('prescriptionsSignIn'), values: kept };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message, values: kept };
    console.error('prescription send failed', error);
    return { ok: false, message: t('prescriptionsSendFailed'), values: kept };
  }
}

/** Uploads one file with the customer's token (POST /uploads); the form then sends its id. */
export async function uploadPrescriptionFileAction(rawLocale: Locale, form: FormData): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const locale = localeOf(rawLocale);
  const t = translator(locale);
  const token = await customerToken();
  const file = form.get('file');
  if (!token) return { ok: false, message: t('prescriptionsSignIn') };
  if (!(file instanceof File) || !file.name) return { ok: false, message: t('contentFormUploadFailed') };
  try {
    const uploaded = await uploadFile(storefrontClient(), { locale, token }, file, file.name);
    return { ok: true, id: uploaded.id, name: uploaded.name };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') return { ok: false, message: Object.values(error.fieldErrors)[0]?.[0] ?? error.message };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('prescription upload failed', error);
    return { ok: false, message: t('contentFormUploadFailed') };
  }
}

/** Cancels one (only while `actions.canCancel`; the backend refuses otherwise with its message). */
export async function cancelPrescriptionAction(rawLocale: Locale, prescriptionId: string, reasonId: number, note: string | null): Promise<CancelOrderResult> {
  const locale = localeOf(rawLocale);
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('prescriptionsSignIn') };
  try {
    const cancelled = await cancelPrescription(storefrontClient(), { locale, token }, prescriptionId, { reasonId, note });
    revalidatePath('/[locale]/prescriptions', 'page');
    return { ok: true, message: cancelled.status.label };
  } catch (error) {
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('prescription cancel failed', error);
    return { ok: false, message: t('orderActionError') };
  }
}
