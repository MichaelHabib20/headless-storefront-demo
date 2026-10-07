import { headers } from 'next/headers';
import { requestOrigin } from '@/lib/jsonld';
import { loadSitemapPage } from '@/lib/seo.server';
import { parseChildSitemapName, SITEMAP_PAGE_SIZE, urlSetXml, xmlResponse } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/** GET /sitemap_<type>_<locale>[_<page>].xml (rewritten here by next.config.mjs): one page of one type of `GET /sitemap`, as a urlset. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const child = parseChildSitemapName((await params).name);
  if (!child) return new Response('Not found', { status: 404 });
  const data = await loadSitemapPage(child.locale, child.type, child.page, SITEMAP_PAGE_SIZE);
  if (!data) return new Response('Sitemap unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  if (child.page > Math.max(1, data.pagination.totalPages)) return new Response('Not found', { status: 404 });
  return xmlResponse(urlSetXml(requestOrigin(await headers()), child.locale, data.items));
}
