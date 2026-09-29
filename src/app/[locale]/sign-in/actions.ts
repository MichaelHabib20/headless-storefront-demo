'use server';

import { redirect } from 'next/navigation';
import { getAuthConfig, isLocale, login, type LoginInput } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { routes } from '@/lib/routing';
import { saveSession } from '@/lib/session';
import { storeClient } from '@/lib/store';

export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = isLocale(formData.get('locale')) ? (formData.get('locale') as 'en' | 'ar') : 'en';
  const identifier = field(formData, 'identifier');
  const password = String(formData.get('password') ?? '');
  const values = { identifier };

  try {
    const client = storeClient(locale);
    // The store decides email vs phone; re-read it here instead of trusting the form.
    const { loginMethod } = await getAuthConfig(client);
    const input: LoginInput = loginMethod === 'phone'
      ? { method: 'phone', phone: identifier, password }
      : { method: 'email', email: identifier, password };
    await saveSession(await login(client, input));
  } catch (error) {
    return toFormState(error, values, { email: 'identifier', phone: 'identifier' });
  }

  redirect(routes.account(locale));
}
