/**
 * The storefront's public origin ("https://shop.example.com"): where canonical, hreflang, og:url,
 * JSON-LD, sitemap and robots.txt URLs point.
 *
 * - `SC_SITE_URL` (per deployment) is the store's canonical address: set it on the production
 *   deployment (e.g. https://seif-online.com). Every other host that serves the same deployment
 *   (the *.vercel.app alias, a preview) is then a test host: robots.txt disallows everything there
 *   and pages answer `X-Robots-Tag: noindex`, while their links still point at the canonical origin.
 * - Without it, the origin of the request is used (and only the backend decides about indexing).
 *
 * Server code only (route handlers, metadata, middleware): it reads the environment.
 */

/** Headers of the request (next/headers or a plain Headers in tests). */
export interface HeaderReader {
  get(name: string): string | null;
}

const HTTP_ORIGIN = /^https?:\/\/[A-Za-z0-9.-]+(:\d{1,5})?$/i;
const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](:\d{1,5})?$/;

/** `SC_SITE_URL` without a trailing slash; null when it is not set or not a plain http(s) origin. */
export function configuredOrigin(value: string | undefined = process.env.SC_SITE_URL): string | null {
  const origin = value?.trim().replace(/\/+$/, '');
  return origin && HTTP_ORIGIN.test(origin) ? origin.toLowerCase() : null;
}

/** The host the visitor asked for (`x-forwarded-host`, else `host`); null when missing or not a host name. */
export function requestHost(headers: HeaderReader): string | null {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0].trim();
  return HOST.test(host) ? host : null;
}

/** The public origin the visitor used: `x-forwarded-host` / `host` and `x-forwarded-proto`; '' when unknown. */
export function requestOrigin(headers: HeaderReader): string {
  const host = requestHost(headers);
  if (!host) return '';
  const forwarded = (headers.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(host);
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : local ? 'http' : 'https';
  return `${proto}://${host}`;
}

/** The origin URLs are written with: `SC_SITE_URL` when it is set, else the request's ('' when unknown). */
export function publicOrigin(headers: HeaderReader): string {
  return configuredOrigin() ?? requestOrigin(headers);
}

/**
 * Whether this request came in on a host other than the configured canonical one (a test or preview
 * host of the same deployment). Always false without `SC_SITE_URL`.
 */
export function isTestHost(headers: HeaderReader): boolean {
  const canonical = configuredOrigin();
  if (!canonical) return false;
  const host = requestHost(headers);
  return !host || host.toLowerCase() !== new URL(canonical).host;
}
