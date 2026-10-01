'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isLocale, sendPhoneCode, verifyPhone, type Locale } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { routes, safeReturnPath } from '@/lib/routing';
import { customerToken, saveSession } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

export interface VerifyState extends FormState {
  sent?: { message: string; destination: string | null };
}

const localeOf = (value: unknown): Locale => (isLocale(value) ? value : 'en');

/** Sends the SMS code again (customer token only). */
export async function sendPhoneCodeAction(_previous: VerifyState, formData: FormData): Promise<VerifyState> {
  const locale = localeOf(formData.get('locale'));
  const token = await customerToken();
  if (!token) redirect(routes.signIn(locale, routes.verifyPhone(locale)));
  try {
    const sent = await sendPhoneCode(storefrontClient(), { locale, token });
    return { sent: { message: sent.message, destination: sent.destination } };
  } catch (error) {
    return toFormState(error, {}, {}, locale);
  }
}

/** Verifies the code; the refreshed `Customer` goes into the session cookie, then back to the page that asked. */
export async function verifyPhoneAction(_previous: VerifyState, formData: FormData): Promise<VerifyState> {
  const locale = localeOf(formData.get('locale'));
  const token = await customerToken();
  if (!token) redirect(routes.signIn(locale, routes.verifyPhone(locale)));
  const code = field(formData, 'code');
  try {
    const customer = await verifyPhone(storefrontClient(), { locale, token }, code);
    await saveSession({ token, customer, next: null });
  } catch (error) {
    return toFormState(error, {}, {}, locale);
  }
  revalidatePath('/[locale]', 'layout');
  redirect(safeReturnPath(formData.get('next') as string | null) ?? routes.account(locale));
}
