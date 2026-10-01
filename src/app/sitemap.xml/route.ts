import { headers } from 'next/headers';
import { LOCALES } from '@/sdk';
import { requestOrigin } from '@/lib/jsonld';
import { loadSiteSeo, loadSitemapPage } from '@/lib/seo.server';
import { SITEMAP_PAGE_SIZE, SITEMAP_TYPES, sitemapIndexXml, xmlResponse, type ChildSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/**
 * GET /sitemap.xml: the sitemap index. One child sitemap per type, language and page of
 * `GET /sitemap` (its `pagination.totalPages`). A store the backend hides from search engines
 * (`SiteSeo.robots.index` false) lists nothing.
 */
export async function GET(): Promise<Response> {
  const origin = requestOrigin(await headers());
  const site = await loadSiteSeo('en');
  if (site && !site.robots.index) return xmlResponse(sitemapIndexXml(origin, []));

  const children: ChildSitemap[] = [];
  const firstPages = await Promise.all(
    SITEMAP_TYPES.flatMap((type) => LOCALES.map(async (locale) => ({ type, locale, first: await loadSitemapPage(locale, type, 1, SITEMAP_PAGE_SIZE) }))),
  );
  for (const { type, locale, first } of firstPages) {
    if (!first || first.pagination.total === 0) continue;
    for (let page = 1; page <= first.pagination.totalPages; page++) children.push({ type, locale, page });
  }
  return xmlResponse(sitemapIndexXml(origin, children));
}
