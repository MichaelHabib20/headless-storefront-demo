'use server';

import { redirect } from 'next/navigation';
import { isLocale, signup } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { routes } from '@/lib/routing';
import { saveSession } from '@/lib/session';
import { storeClient } from '@/lib/store';

export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = isLocale(formData.get('locale')) ? (formData.get('locale') as 'en' | 'ar') : 'en';
  const values = {
    firstName: field(formData, 'firstName'),
    lastName: field(formData, 'lastName'),
    email: field(formData, 'email'),
    phone: field(formData, 'phone'),
    birthdate: field(formData, 'birthdate'),
    referralCode: field(formData, 'referralCode'),
  };
  const password = String(formData.get('password') ?? '');

  // The backend does not check the confirmation, so it is the storefront's job.
  if (password !== String(formData.get('passwordConfirmation') ?? '')) {
    return { fieldErrors: { passwordConfirmation: 'Passwords do not match.' }, values };
  }

  try {
    await saveSession(await signup(storeClient(locale), { ...values, password }));
  } catch (error) {
    return toFormState(error, values);
  }

  redirect(routes.account(locale));
}
