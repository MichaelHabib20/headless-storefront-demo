import { headers } from 'next/headers';
import { LOCALES } from '@/sdk';
import { requestOrigin } from '@/lib/jsonld';
import { PRIVATE_SECTIONS, routes } from '@/lib/routing';
import { loadSiteSeo } from '@/lib/seo.server';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt.
 * 1. The backend decides whether the store may be indexed at all (`SiteSeo.robots.index`: false for a
 *    store switched off, hidden or on a non-production backend → `Disallow: /`).
 * 2. `ROBOTS_TXT`, when the deployment sets it, is the file as it is: the old storefront's deploy wrote
 *    robots.txt from the same variable, so each store keeps its own rules.
 * 3. Otherwise the shopper's private pages (PRIVATE_SECTIONS) and the API are kept out, with the
 *    sitemap index of this origin.
 * When the backend cannot be reached the site stays indexable (a blip must not de-index a live store).
 */
export async function GET(): Promise<Response> {
  const site = await loadSiteSeo('en');
  if (site && !site.robots.index) return text('User-agent: *\nDisallow: /\n');

  const custom = process.env.ROBOTS_TXT;
  if (custom && custom.trim()) return text(custom.replace(/\r\n/g, '\n').replace(/\n*$/, '\n'));

  const origin = requestOrigin(await headers());
  const disallow = LOCALES.flatMap((locale) => PRIVATE_SECTIONS.map((section) => `${routes.home(locale)}/${section}`));
  const lines = ['User-agent: *', 'Allow: /', ...[...disallow, '/api/'].map((path) => `Disallow: ${path}`), '', `Sitemap: ${origin}/sitemap_index.xml`];
  return text(`${lines.join('\n')}\n`);
}

function text(body: string): Response {
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
