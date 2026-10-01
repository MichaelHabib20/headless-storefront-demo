'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getProfile, isLocale, updateProfile, type Locale } from '@/sdk';
import { toFormState, type FormState } from '@/lib/form';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { customerToken, saveSession } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/**
 * Saves the profile: the values of the editable fields the API lists (re-read here, never trusted
 * from the browser), keyed by name. A changed phone sends the shopper to the verification page; a
 * changed e-mail waits for the confirmation mail (the API's `next`).
 */
export async function updateProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) redirect(routes.signIn(locale, routes.profile(locale)));

  const client = storefrontClient();
  const ctx = { locale, token };
  const values: Record<string, string> = {};
  let next: 'verify_phone' | 'verify_email' | null;
  try {
    const current = await getProfile(client, ctx);
    for (const field of current.fields) {
      const raw = formData.get(field.name);
      if (field.editable && typeof raw === 'string') values[field.name] = raw.trim();
    }
    const saved = await updateProfile(client, ctx, values);
    await saveSession({ token, customer: saved.customer, next: null });
    next = saved.next;
  } catch (error) {
    return toFormState(error, values, {}, locale);
  }
  revalidatePath('/[locale]', 'layout');
  if (next === 'verify_phone') redirect(`${routes.verifyPhone(locale)}?next=${encodeURIComponent(routes.profile(locale))}`);
  return { message: next === 'verify_email' ? t('profileVerifyEmailSent') : t('profileSaved'), values: {} };
}
