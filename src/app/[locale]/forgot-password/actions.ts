'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { forgotPassword, isLocale, type Locale } from '@/sdk';
import { field, toFormState, type FormState } from '@/lib/form';
import { routes } from '@/lib/routing';
import { storefrontClient } from '@/lib/storefront.server';

export interface ForgotState extends FormState {
  /** E-mail method: the link was sent (the page shows the backend's message). */
  sent?: { message: string; destination: string | null };
}

/** This storefront's own origin, for the reset link the backend mails (it must be on an allowed origin). */
async function storefrontOrigin(): Promise<string | null> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return null;
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * Starts a password reset. The backend says which method the store uses: a code by SMS → the reset
 * page asks for it; a link by e-mail → the message is shown here.
 */
export async function forgotPasswordAction(_previous: ForgotState, formData: FormData): Promise<ForgotState> {
  const locale: Locale = isLocale(formData.get('locale')) ? (formData.get('locale') as Locale) : 'en';
  const identifier = field(formData, 'identifier');
  const origin = await storefrontOrigin();
  let method: 'sms' | 'email';
  let result: { message: string; destination: string | null };
  try {
    const answer = await forgotPassword(storefrontClient(), locale, { identifier, resetUrl: origin ? `${origin}${routes.resetPassword(locale)}` : null });
    method = answer.method;
    result = { message: answer.message, destination: answer.destination };
  } catch (error) {
    return toFormState(error, { identifier }, {}, locale);
  }
  if (method === 'email') return { sent: result, values: { identifier } };
  redirect(`${routes.resetPassword(locale)}?phone=${encodeURIComponent(identifier)}`);
}
