import 'server-only';
import { isApiError, resolvePath, type Locale } from '@/sdk';
import { answerForResolution, type PathAnswer } from './resolve';
import { storefrontClient } from './storefront.server';

/**
 * Asks the backend what a path the storefront has no page for is (old storefront URLs, the
 * merchant's redirect table). `requested` is the full request URL; the backend gets its path and
 * query with the locale prefix. null = the backend could not answer (the page then says 404).
 */
export async function answerUnknownPath(locale: Locale, requested: URL): Promise<PathAnswer | null> {
  let search = requested.search;
  if (requested.searchParams.has('_rsc')) {
    // Next.js's own marker on client navigations is not part of the requested URL.
    const query = new URLSearchParams(search);
    query.delete('_rsc');
    search = query.size ? `?${query}` : '';
  }
  try {
    const resolution = await resolvePath(storefrontClient(), locale, requested.pathname + search);
    return answerForResolution(resolution, locale, requested);
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'not_found') console.error('resolving an unknown path failed', error);
    return isApiError(error) && error.kind === 'not_found' ? { kind: 'not_found' } : null;
  }
}
