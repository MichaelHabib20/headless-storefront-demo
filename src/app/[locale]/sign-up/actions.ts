'use server';

import { redirect } from 'next/navigation';
import { getAuthSettings, isLocale, signUp, type NextStep } from '@/sdk';
import { toFormState, type FormState } from '@/lib/form';
import { translator } from '@/lib/i18n';
import { nextStepHref, routes } from '@/lib/routing';
import { startSession } from '@/lib/session';
import { guestToken } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

const CONFIRMATION = 'passwordConfirmation';

/**
 * Sign-up: the values are read for the fields the store's form lists (`AuthSettings.signup.fields`,
 * re-read here rather than trusted from the browser) and sent keyed by name; the backend validates
 * them. The password confirmation is the storefront's own check.
 */
export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = isLocale(formData.get('locale')) ? formData.get('locale') as 'en' | 'ar' : 'en';
  const client = storefrontClient();
  const values: Record<string, string> = {};
  let next: NextStep | null;

  try {
    const settings = await getAuthSettings(client, locale);
    if (!settings.signup.enabled) return { message: translator(locale)('authSignUpClosed') };
    for (const field of settings.signup.fields) {
      const raw = formData.get(field.name);
      if (typeof raw === 'string') values[field.name] = field.kind === 'password' ? raw : raw.trim();
    }
    const shown = Object.fromEntries(Object.entries(values).filter(([name]) => settings.signup.fields.find((f) => f.name === name)?.kind !== 'password'));
    if (settings.signup.fields.some((f) => f.name === 'password') && values.password !== String(formData.get(CONFIRMATION) ?? '')) {
      return { fieldErrors: { [CONFIRMATION]: translator(locale)('authPasswordsMismatch') }, values: shown };
    }
    // The guest token goes along: the guest row becomes the customer (cart and lists kept).
    const session = await signUp(client, { locale, token: await guestToken() }, values);
    await startSession(session);
    next = session.next;
  } catch (error) {
    const shown = Object.fromEntries(Object.entries(values).filter(([name]) => name !== 'password'));
    return toFormState(error, shown, {}, locale);
  }

  redirect(nextStepHref(locale, next) ?? routes.account(locale));
}
