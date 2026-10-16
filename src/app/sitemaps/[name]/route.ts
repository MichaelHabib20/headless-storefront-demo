import { headers } from 'next/headers';
import { publicOrigin } from '@/lib/origin';
import { loadSitemapPage } from '@/lib/seo.server';
import { loadSitemapFile, parseChildSitemapName, urlSetXml, xmlResponse } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';

/** GET /sitemap_<type>_<locale>[_<n>].xml (rewritten here by next.config.mjs): one file of one type, as a urlset. */
export async function GET(_request: Request, { params }: { params: Promise<{ name: string }> }): Promise<Response> {
  const child = parseChildSitemapName((await params).name);
  if (!child) return new Response('Not found', { status: 404 });
  const entries = await loadSitemapFile(loadSitemapPage, child);
  if (!entries) return new Response('Sitemap unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  if (entries === 'missing') return new Response('Not found', { status: 404 });
  return xmlResponse(urlSetXml(publicOrigin(await headers()), child.locale, entries));
}
