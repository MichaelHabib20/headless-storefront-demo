'use server';

import { getForm, isApiError, isLocale, submitForm, uploadFile, type FormField, type Locale } from '@/sdk';
import { formValues, type ContentFormState } from '@/components/content/form-values';
import { translator } from '@/lib/i18n';
import { withShopper } from '@/lib/shopper.write';
import { storefrontClient } from '@/lib/storefront.server';

const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/**
 * Answers a merchant form (POST /forms/{slug}/responses). The values are read for the fields the API
 * describes (`Form.fields`); the backend validates them and its messages are shown by field.
 */
export async function submitFormAction(_state: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const locale = localeOf(formData.get('locale'));
  const slug = formData.get('slug');
  const t = translator(locale);
  if (typeof slug !== 'string' || !slug) return { ok: false, message: t('contentFormSubmitFailed') };

  let fields: FormField[] = [];
  let values: Record<string, string | string[]> = {};
  try {
    fields = (await getForm(storefrontClient(), locale, slug)).fields;
    values = formValues(fields, formData);
    const sent = await withShopper(locale, (ctx) => submitForm(storefrontClient(), ctx, slug, values));
    return { ok: true, message: sent.message };
  } catch (error) {
    // what the shopper typed comes back, but never a file id (the file is chosen again)
    const files = new Set(fields.filter((field) => field.kind === 'file').map((field) => field.name));
    const kept = Object.fromEntries(Object.entries(values).filter(([name]) => !files.has(name)));
    if (isApiError(error) && error.kind === 'validation') {
      const fieldErrors: Record<string, string> = {};
      for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
      return { ok: false, message: error.message, fieldErrors, values: kept };
    }
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('contentFormSessionExpired'), values: kept };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message, values: kept };
    console.error('form answer failed', error);
    return { ok: false, message: t('contentFormSubmitFailed'), values: kept };
  }
}

/** Uploads a file of a form field (POST /uploads); the field then sends the returned id. */
export async function uploadFormFileAction(rawLocale: Locale, form: FormData): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const locale = localeOf(rawLocale);
  const t = translator(locale);
  const file = form.get('file');
  if (!(file instanceof File) || !file.name) return { ok: false, message: t('contentFormUploadFailed') };
  try {
    const uploaded = await withShopper(locale, (ctx) => uploadFile(storefrontClient(), ctx, file, file.name));
    return { ok: true, id: uploaded.id, name: uploaded.name };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') return { ok: false, message: Object.values(error.fieldErrors)[0]?.[0] ?? error.message };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('form upload failed', error);
    return { ok: false, message: t('contentFormUploadFailed') };
  }
}
