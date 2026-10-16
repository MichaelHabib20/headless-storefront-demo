import 'server-only';
import { getAuthSettings, getProfile, isApiError, type AuthSettings, type Layout, type Locale, type Profile } from '@/sdk';
import type { AccountResult } from './account.server';
import { translator, type MessageKey } from './i18n';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

export type AuthSettingsResult = { ok: true; settings: AuthSettings } | { ok: false; message: string };

/** What the sign-in / sign-up pages show (public, decided by the store), or a message when the store can't be reached. */
export async function loadAuthSettings(locale: Locale): Promise<AuthSettingsResult> {
  try {
    return { ok: true, settings: await getAuthSettings(storefrontClient(), locale) };
  } catch (error) {
    if (!isApiError(error)) console.error('auth settings failed to load', error);
    return { ok: false, message: translator(locale)('authStoreUnreachable') };
  }
}

/** The store's WhatsApp chat (`Layout.whatsapp`) for "contact us" notes; null when it has none or the layout failed. */
export async function loadStoreWhatsapp(locale: Locale): Promise<Layout['whatsapp'] | null> {
  try {
    return (await loadLayout(locale)).whatsapp ?? null;
  } catch {
    return null;
  }
}

/**
 * The customer's profile (needs the customer token; a guest has none → `signed-out`, like the API's
 * 401). Rendering never creates a guest and never writes.
 */
export async function loadProfile(locale: Locale): Promise<AccountResult<Profile>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await getProfile(storefrontClient(), { locale, token }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    console.error('profile failed to load', error);
    return { status: 'error' };
  }
}

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/** The text an auth action shows when the API refused or failed: the backend's localized message, or ours. */
export function authFailureMessage(error: unknown, locale: Locale, fallback: MessageKey = 'authGenericError'): string {
  const t = translator(locale);
  if (isApiError(error) && error.kind === 'unauthenticated') return t('authSessionGone');
  if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return error.message;
  console.error('auth action failed', error);
  return t(fallback);
}
