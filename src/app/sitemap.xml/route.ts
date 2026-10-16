import { headers } from 'next/headers';
import { publicOrigin } from '@/lib/origin';
import { loadSitemapPage } from '@/lib/seo.server';
import { SITEMAP_LOCALES, SITEMAP_TYPES, sitemapFileCount, sitemapIndexXml, xmlResponse, type ChildSitemap } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/**
 * GET /sitemap_index.xml (the old storefront's name, rewritten here) and /sitemap.xml: the sitemap
 * index, under the canonical origin. One child per type, language and file of 50,000 URLs, in the
 * old index's order; a type without entries (or whose count failed to load) is left out.
 *
 * It always lists what exists, also for a store or host that may not be indexed: robots.txt keeps
 * crawlers out there (src/app/robots.txt/route.ts), and the files can still be checked before a
 * domain switch.
 */
export async function GET(): Promise<Response> {
  const origin = publicOrigin(await headers());
  const counts = await Promise.all(
    SITEMAP_TYPES.flatMap((type) => SITEMAP_LOCALES.map(async (locale) => ({ type, locale, first: await loadSitemapPage(locale, type, 1, 1) }))),
  );
  const children: ChildSitemap[] = [];
  for (const { type, locale, first } of counts) {
    const files = first ? sitemapFileCount(first.pagination.total) : 0;
    for (let page = 1; page <= files; page++) children.push({ type, locale, page });
  }
  return xmlResponse(sitemapIndexXml(origin, children));
}
