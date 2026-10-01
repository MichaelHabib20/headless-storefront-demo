'use server';

import { redirect } from 'next/navigation';
import { isLocale, signOut, type Locale } from '@/sdk';
import { routes } from './routing';
import { clearSession, customerToken } from './session';
import { forgetGuest } from './shopper.server';
import { storefrontClient } from './storefront.server';

/**
 * Sign out, from the account menu and the account pages: revokes the token at the backend
 * (`POST /auth/sign-out`; a token that no longer works is already signed out), then drops the
 * session and guest cookies and goes home.
 */
export async function signOutAction(rawLocale: Locale | string): Promise<void> {
  const locale = isLocale(rawLocale) ? rawLocale : 'en';
  const token = await customerToken();
  if (token) {
    try {
      await signOut(storefrontClient(), { locale, token });
    } catch (error) {
      console.error('sign-out at the backend failed; the cookies are dropped anyway', error);
    }
  }
  await clearSession();
  await forgetGuest();
  redirect(routes.home(locale));
}
