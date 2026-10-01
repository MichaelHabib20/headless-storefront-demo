'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { completeSocialProfile, isLocale, type Locale, type NextStep } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { nextStepHref, routes } from '@/lib/routing';
import { customerToken, saveSession } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** After a social sign-in without a phone: the name and phone (contract `CompleteProfileRequest`, a fixed shape). */
export async function completeProfileAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const token = await customerToken();
  if (!token) redirect(routes.signIn(locale, routes.completeProfile(locale)));
  const values = { firstName: field(formData, 'firstName'), lastName: field(formData, 'lastName'), phone: field(formData, 'phone'), email: field(formData, 'email') };
  let next: NextStep | null;
  try {
    const session = await completeSocialProfile(storefrontClient(), { locale, token }, { ...values, email: values.email || null, birthdate: null });
    await saveSession(session);
    next = session.next;
  } catch (error) {
    return toFormState(error, values, {}, locale);
  }
  revalidatePath('/[locale]', 'layout');
  redirect(nextStepHref(locale, next) ?? routes.account(locale));
}
