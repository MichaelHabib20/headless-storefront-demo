import type { Locale, Resolution } from '@/sdk';
import { isStorefrontPath, resolveTarget } from './routing';

/**
 * Request header the middleware sets on a path the backend says is gone, so the catch-all page
 * shows the "no longer available" page (the middleware answers 410). Visitors cannot set it:
 * the middleware replaces it on every path it resolves.
 */
export const RESOLUTION_HEADER = 'x-storefront-resolution';

/** What the storefront answers for a path it has no page for. */
export type PathAnswer =
  | { kind: 'redirect'; location: string; status: 301 | 302 }
  | { kind: 'gone' }
  | { kind: 'not_found' };

const NOT_FOUND: PathAnswer = { kind: 'not_found' };

/**
 * Turns the backend's Resolution into an answer: `target` → permanent redirect to our URL of it;
 * `redirect` → to its Target (or else its `url`), permanent or not as told; `gone` → 410;
 * anything else → 404.
 *
 * It can never loop: a destination on this site must be one of the storefront's own routes
 * (never another unknown path, never the requested path itself), and only http(s) is followed.
 * Anything else ends as not found.
 */
export function answerForResolution(resolution: Resolution, locale: Locale, requested: URL): PathAnswer {
  if (resolution.result === 'gone') return { kind: 'gone' };
  if (resolution.result === 'target') return redirectTo(resolveTarget(resolution.target, locale)?.href, 301, requested);
  if (resolution.result === 'redirect') {
    const destination = resolveTarget(resolution.target, locale)?.href ?? resolution.url;
    return redirectTo(destination, resolution.permanent ? 301 : 302, requested);
  }
  return NOT_FOUND;
}

function redirectTo(href: string | null | undefined, status: 301 | 302, requested: URL): PathAnswer {
  if (!href) return NOT_FOUND;
  let destination: URL;
  try {
    destination = new URL(href, requested);
  } catch {
    return NOT_FOUND;
  }
  if (destination.protocol !== 'https:' && destination.protocol !== 'http:') return NOT_FOUND;
  if (destination.origin !== requested.origin) return { kind: 'redirect', location: destination.href, status };

  const location = destination.pathname + destination.search + destination.hash;
  const same = destination.pathname + destination.search === requested.pathname + requested.search;
  if (same || !isStorefrontPath(destination.pathname)) return NOT_FOUND;
  return { kind: 'redirect', location, status };
}
