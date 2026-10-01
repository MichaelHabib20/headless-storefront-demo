import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { LOCALES } from '@/sdk';
import { requestOrigin } from '@/lib/jsonld';
import { PRIVATE_SECTIONS, routes } from '@/lib/routing';
import { loadSiteSeo } from '@/lib/seo.server';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt. The backend decides whether the store may be indexed at all (`SiteSeo.robots.index`:
 * false for a store switched off, hidden or on a non-production backend → `Disallow: /`). The
 * shopper's private pages are this storefront's own list (PRIVATE_SECTIONS). When the backend
 * cannot be reached the site stays indexable (a blip must not de-index a live store).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = requestOrigin(await headers());
  const site = await loadSiteSeo('en');
  if (site && !site.robots.index) return { rules: { userAgent: '*', disallow: '/' } };

  const disallow = LOCALES.flatMap((locale) => PRIVATE_SECTIONS.map((section) => `${routes.home(locale)}/${section}`));
  return {
    rules: { userAgent: '*', allow: '/', disallow: [...disallow, '/api/'] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
