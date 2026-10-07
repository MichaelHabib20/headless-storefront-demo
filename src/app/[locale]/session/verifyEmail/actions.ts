'use server';

import { isLocale, verifyEmail, type Locale } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { storefrontClient } from '@/lib/storefront.server';

export interface VerifyEmailState extends FormState {
  done?: string;
}

/** Confirms the new e-mail with the `email` + `token` from the mail's link (a click, never on page load). */
export async function verifyEmailAction(_previous: VerifyEmailState, formData: FormData): Promise<VerifyEmailState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  try {
    const result = await verifyEmail(storefrontClient(), locale, { email: field(formData, 'email'), token: field(formData, 'token') });
    return { done: result.message };
  } catch (error) {
    return toFormState(error, {}, {}, locale);
  }
}
