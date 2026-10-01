'use server';

import { redirect } from 'next/navigation';
import { isLocale, sendOtp, signIn, signInWithOtp, signInWithProvider, type Locale, type NextStep, type SocialProvider } from '@/sdk';
import { authFailureMessage } from '@/lib/auth.server';
import { field, toFormState, type FormState } from '@/lib/form';
import { nextStepHref, routes, signInReturn } from '@/lib/routing';
import { startSession } from '@/lib/session';
import { guestToken } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

const PROVIDERS: readonly SocialProvider[] = ['google', 'facebook', 'apple'];

function localeOf(value: unknown): Locale {
  return isLocale(value) ? value : 'en';
}

/**
 * Where a fresh session goes: the backend's `next` step first (verify the phone, wait for approval,
 * complete a social profile), else the local page that asked for the sign-in, else the account.
 */
export async function afterSignIn(locale: Locale, next: NextStep | null, returnTo: unknown): Promise<string> {
  return nextStepHref(locale, next) ?? signInReturn(locale, typeof returnTo === 'string' ? returnTo : null) ?? routes.account(locale);
}

/** Password sign-in. The identifier goes to the backend as typed: it decides e-mail vs phone. */
export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const locale = localeOf(formData.get('locale'));
  const identifier = field(formData, 'identifier');
  const password = String(formData.get('password') ?? '');
  const values = { identifier };

  let next: NextStep | null;
  try {
    // The guest token goes along so the backend merges the guest's cart, wishlist and compare list.
    const session = await signIn(storefrontClient(), { locale, token: await guestToken() }, { identifier, password });
    await startSession(session);
    next = session.next;
  } catch (error) {
    return toFormState(error, values, {}, locale);
  }
  redirect(await afterSignIn(locale, next, formData.get('next')));
}

export interface OtpState {
  /** The code was sent: the form shows the code input. */
  sent?: { phone: string; message: string; destination: string | null };
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

/** OTP sign-in, step 1: the backend sends the code (only when `AuthSettings.otpLogin`). */
export async function sendOtpAction(_previous: OtpState, formData: FormData): Promise<OtpState> {
  const locale = localeOf(formData.get('locale'));
  const phone = field(formData, 'phone');
  try {
    const sent = await sendOtp(storefrontClient(), locale, phone);
    return { sent: { phone, message: sent.message, destination: sent.destination }, values: { phone } };
  } catch (error) {
    return toFormState(error, { phone }, {}, locale);
  }
}

/** OTP sign-in, step 2: the code signs the shopper in (and merges the guest). */
export async function signInWithOtpAction(_previous: OtpState, formData: FormData): Promise<OtpState> {
  const locale = localeOf(formData.get('locale'));
  const phone = field(formData, 'phone');
  const code = field(formData, 'code');
  let next: NextStep | null;
  try {
    const session = await signInWithOtp(storefrontClient(), { locale, token: await guestToken() }, { phone, code });
    await startSession(session);
    next = session.next;
  } catch (error) {
    const state = toFormState(error, { phone, code: '' }, {}, locale);
    return { ...state, sent: { phone, message: '', destination: null } };
  }
  redirect(await afterSignIn(locale, next, formData.get('next')));
}

/** Social sign-in: the provider's token (from its browser SDK) is verified by the backend. */
export async function socialSignInAction(rawLocale: Locale, provider: SocialProvider, token: string, name: string | null, returnTo: string | null): Promise<{ ok: boolean; message?: string }> {
  const locale = localeOf(rawLocale);
  if (!PROVIDERS.includes(provider) || typeof token !== 'string' || token === '') return { ok: false, message: authFailureMessage(undefined, locale, 'authSocialFailed') };
  let next: NextStep | null;
  try {
    const session = await signInWithProvider(storefrontClient(), { locale, token: await guestToken() }, { provider, token, name: name || null });
    await startSession(session);
    next = session.next;
  } catch (error) {
    return { ok: false, message: authFailureMessage(error, locale, 'authSocialFailed') };
  }
  redirect(await afterSignIn(locale, next, returnTo));
}
