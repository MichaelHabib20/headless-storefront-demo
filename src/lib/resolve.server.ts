import 'server-only';
import { isApiError, resolvePath, type Locale } from '@/sdk';
import { answerForResolution, type PathAnswer } from './resolve';
import { storefrontClient } from './storefront.server';

/** How long an answer is reused: a new row in the merchant's redirect table applies within a minute. */
const CACHE_MS = 60_000;
const CACHE_MAX = 5000;
const answers = new Map<string, { until: number; answer: PathAnswer }>();

/**
 * Asks the backend about a path (`requested` is the full request URL; the backend gets its path and
 * query with the locale prefix):
 * - a path the storefront has no page for: old storefront URLs and the merchant's redirect table;
 * - `redirectsOnly`, a page the storefront has: only the redirect table, which may still move it or
 *   mark it gone (the old storefront checked it on every request).
 * Answers are reused for a minute. null = the backend could not answer (the page then renders / says 404).
 */
export async function answerPath(locale: Locale, requested: URL, redirectsOnly = false): Promise<PathAnswer | null> {
  let search = requested.search;
  if (requested.searchParams.has('_rsc')) {
    // Next.js's own marker on client navigations is not part of the requested URL.
    const query = new URLSearchParams(search);
    query.delete('_rsc');
    search = query.size ? `?${query}` : '';
  }
  const path = requested.pathname + search;
  const key = `${redirectsOnly ? 'r' : 'a'}|${locale}|${requested.origin}${path}`;
  const now = Date.now();
  const cached = answers.get(key);
  if (cached && cached.until > now) return cached.answer;

  let answer: PathAnswer;
  try {
    const resolution = await resolvePath(storefrontClient(), locale, path, redirectsOnly);
    answer = answerForResolution(resolution, locale, requested);
  } catch (error) {
    if (!isApiError(error) || error.kind !== 'not_found') {
      console.error('resolving a path failed', error);
      return null;
    }
    answer = { kind: 'not_found' };
  }
  if (answers.size >= CACHE_MAX) answers.clear();
  answers.set(key, { until: now + CACHE_MS, answer });
  return answer;
}

/** A path the storefront has no page for (old storefront URLs, the merchant's redirect table). */
export const answerUnknownPath = (locale: Locale, requested: URL) => answerPath(locale, requested);

/** Test hook: forget the reused answers. */
export function clearPathAnswers(): void {
  answers.clear();
}
