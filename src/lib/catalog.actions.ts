'use server';

import { getSearchSuggestions, isApiError, isLocale, type Locale, type SearchSuggestions } from '@/sdk';
import { shopperContext } from './shopper.server';
import { storefrontClient } from './storefront.server';

export type SuggestionsResult = { ok: true; suggestions: SearchSuggestions } | { ok: false };

/** The contract's longest search text. */
const MAX_QUERY = 200;

/**
 * Products for the header search box while the shopper types. A read: it runs on the server
 * only so the API and the shopper's token (their prices) never reach the browser. It never
 * creates a guest session and never changes data.
 */
export async function searchSuggestionsAction(rawLocale: Locale, rawQuery: string): Promise<SuggestionsResult> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const q = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, MAX_QUERY) : '';
  if (!q) return { ok: false };

  const client = storefrontClient();
  const ctx = await shopperContext(locale);
  try {
    try {
      return { ok: true, suggestions: await getSearchSuggestions(client, ctx, q) };
    } catch (error) {
      if (!ctx.token || !isApiError(error) || error.kind !== 'unauthenticated') throw error;
      return { ok: true, suggestions: await getSearchSuggestions(client, { locale, token: null }, q) };
    }
  } catch (error) {
    if (!isApiError(error)) console.error('search suggestions failed', error);
    return { ok: false };
  }
}
