'use server';

import { redirect } from 'next/navigation';
import { changePassword, isLocale, type Locale } from '@/sdk';
import { toFormState, type FormState } from '@/lib/form';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

export interface PasswordState extends FormState {
  done?: string;
}

export async function changePasswordAction(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) redirect(routes.signIn(locale, routes.changePassword(locale)));
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  if (newPassword !== String(formData.get('passwordConfirmation') ?? '')) {
    return { fieldErrors: { passwordConfirmation: t('authPasswordsMismatch') } };
  }
  try {
    const result = await changePassword(storefrontClient(), { locale, token }, { currentPassword, newPassword });
    return { done: result.message };
  } catch (error) {
    return toFormState(error, {}, {}, locale);
  }
}
