'use server';

import { redirect } from 'next/navigation';
import { getAuthSettings, isLocale, resetPassword, type Locale, type NextStep, type ResetPasswordInput } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { translator } from '@/lib/i18n';
import { nextStepHref, routes } from '@/lib/routing';
import { startSession } from '@/lib/session';
import { guestToken } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

/**
 * Sets the new password with the SMS code (`phone` + `code`) or the e-mail token, as the store's
 * method says (re-read here), and signs the shopper in.
 */
export async function resetPasswordAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const t = translator(locale);
  const password = String(formData.get('password') ?? '');
  const phone = field(formData, 'phone');
  const code = field(formData, 'code');
  const token = field(formData, 'token');
  const values = { phone, code };

  if (password !== String(formData.get('passwordConfirmation') ?? '')) {
    return { fieldErrors: { passwordConfirmation: t('authPasswordsMismatch') }, values };
  }

  let next: NextStep | null;
  try {
    const client = storefrontClient();
    const { passwordReset } = await getAuthSettings(client, locale);
    const input: ResetPasswordInput = passwordReset.method === 'email' ? { password, token } : { password, phone, code };
    const session = await resetPassword(client, { locale, token: await guestToken() }, input);
    await startSession(session);
    next = session.next;
  } catch (error) {
    return toFormState(error, values, {}, locale);
  }
  redirect(nextStepHref(locale, next) ?? routes.account(locale));
}
