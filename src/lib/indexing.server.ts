import 'server-only';
import { PRIVATE_SECTIONS } from './routing';
import { isTestHost, type HeaderReader } from './origin';
import { loadSiteSeo } from './seo.server';

/**
 * Whether a page answers `X-Robots-Tag: noindex, nofollow` (src/middleware.ts). The same policy as
 * robots.txt (src/app/robots.txt/route.ts), so a host that robots.txt blocks never serves an
 * indexable page:
 * 1. The shopper's private pages: always noindex.
 * 2. A test host (`SC_SITE_URL` is set and this request came in on another host): always noindex.
 * 3. The backend says the store may not be indexed (`SiteSeo.robots.index` false: a staging backend,
 *    DISABLE_SEARCH_ENGINE_INDEXING, a store switched off): noindex, with or without `SC_SITE_URL`.
 * 4. Otherwise indexable: the production host of `SC_SITE_URL`, or a deployment without it, whose
 *    backend allows indexing. When the backend cannot be reached the page stays indexable (a blip
 *    must not de-index a live store), like robots.txt.
 */
export async function shouldNoindex(pathname: string, headers: HeaderReader): Promise<boolean> {
  const section = pathname.split('/')[2] ?? '';
  if ((PRIVATE_SECTIONS as readonly string[]).includes(section)) return true;
  if (isTestHost(headers)) return true;
  return !(await backendAllowsIndexing());
}

/** The backend's answer is reused for `SC_REVALIDATE_SECONDS` (60 by default), like the API's other cached reads. */
let remembered: { until: number; index: boolean } | null = null;

/** `SiteSeo.robots.index`; true when the backend cannot be reached (that answer is not reused). */
export async function backendAllowsIndexing(): Promise<boolean> {
  const now = Date.now();
  if (remembered && remembered.until > now) return remembered.index;
  const site = await loadSiteSeo('en');
  if (!site) return true;
  const seconds = Number(process.env.SC_REVALIDATE_SECONDS ?? 60);
  remembered = { until: now + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0), index: site.robots.index !== false };
  return remembered.index;
}

/** Test hook: forget the reused answer. */
export function clearIndexingAnswer(): void {
  remembered = null;
}
