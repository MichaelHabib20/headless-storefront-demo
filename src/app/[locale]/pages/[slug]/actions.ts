'use server';

import { getPage, isApiError, isLocale, sendContactMessage, type Locale } from '@/sdk';
import { formValues, textValues, type ContentFormState } from '@/components/content/form-values';
import { translator } from '@/lib/i18n';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only, or not helpful): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/**
 * Sends the contact form (POST /contact). The fields are the ones the API described for the page
 * (`Page.contact.fields`), read again here so nothing else from the browser is passed on. No
 * shopper session is needed or created.
 */
export async function sendContactAction(_state: ContentFormState, formData: FormData): Promise<ContentFormState> {
  const raw = formData.get('locale');
  const locale: Locale = isLocale(raw) ? raw : 'en';
  const t = translator(locale);
  const client = storefrontClient();

  let values: Record<string, string> = {};
  try {
    const page = await getPage(client, locale, 'contact');
    values = textValues(formValues(page.contact?.fields ?? [], formData));
    const sent = await sendContactMessage(client, locale, values);
    return { ok: true, message: sent.message };
  } catch (error) {
    if (isApiError(error) && error.kind === 'validation') {
      const fieldErrors: Record<string, string> = {};
      for (const [name, messages] of Object.entries(error.fieldErrors)) if (messages[0]) fieldErrors[name] = messages[0];
      return { ok: false, message: error.message, fieldErrors, values };
    }
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message, values };
    console.error('contact message failed', error);
    return { ok: false, message: t('contentSendFailed'), values };
  }
}
