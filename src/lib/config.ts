import 'server-only';
import { getAuthConfig, isApiError, type AuthConfig, type Locale } from '@/sdk';
import { storeClient } from './store';

export type AuthConfigResult = { ok: true; config: AuthConfig } | { ok: false; message: string };

/** Loads the store's auth settings, or a message to show if the store can't be reached. */
export async function loadAuthConfig(locale: Locale): Promise<AuthConfigResult> {
  try {
    return { ok: true, config: await getAuthConfig(storeClient(locale)) };
  } catch (error) {
    if (!isApiError(error)) console.error(error);
    return { ok: false, message: isApiError(error) ? error.message : 'The store could not be reached.' };
  }
}
