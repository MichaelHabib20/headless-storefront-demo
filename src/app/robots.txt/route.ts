import { headers } from 'next/headers';
import { isTestHost, publicOrigin } from '@/lib/origin';
import { customRobotsTxt, defaultRobotsTxt, DISALLOW_ALL } from '@/lib/robots';
import { loadSiteSeo } from '@/lib/seo.server';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt.
 * 1. A test host disallows everything: `SC_SITE_URL` names the store's canonical address and this
 *    request came in on another host of the same deployment (the *.vercel.app alias, a preview).
 * 2. The backend decides whether the store may be indexed at all (`SiteSeo.robots.index`: false for a
 *    store switched off, hidden with DISABLE_SEARCH_ENGINE_INDEXING, or on a non-production backend)
 *    → `Disallow: /`.
 * 3. `ROBOTS_TXT`, when the deployment sets it, is the file as it is: the old storefront's deploy wrote
 *    robots.txt from the same variable, so each store keeps its own rules.
 * 4. Otherwise the old storefront's rules (src/lib/robots.ts), with the sitemap index of the
 *    canonical origin.
 * When the backend cannot be reached the site stays indexable (a blip must not de-index a live store).
 */
export async function GET(): Promise<Response> {
  const request = await headers();
  if (isTestHost(request)) return text(DISALLOW_ALL);

  const site = await loadSiteSeo('en');
  if (site && !site.robots.index) return text(DISALLOW_ALL);

  return text(customRobotsTxt(process.env.ROBOTS_TXT) ?? defaultRobotsTxt(publicOrigin(request)));
}

function text(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
