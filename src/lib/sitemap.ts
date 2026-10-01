/**
 * Sitemap XML (sitemaps.org) from the backend's `GET /sitemap` entries. The backend lists what
 * exists (Targets, dates, both languages); this file only turns Targets into URLs of this
 * storefront (the origin of the request) and writes the XML. Pure, no I/O.
 *
 *   /sitemap.xml                 → index of the child sitemaps
 *   /sitemaps/<type>-<page>.xml  → one page of one type, every entry with its hreflang alternates
 */
import type { Locale, SitemapEntry, SitemapType } from '@/sdk';
import { resolveTarget } from './routing';

export const SITEMAP_TYPES: readonly SitemapType[] = ['products', 'categories', 'brands', 'pages', 'landing_pages', 'tags'];
/** Entries per child sitemap (one backend page). The protocol allows 50,000; the contract 5,000. */
export const SITEMAP_PAGE_SIZE = 1000;
/** Child sitemaps are per language: the URLs of a sitemap are in the language of its name. */
const NAME = /^(products|categories|brands|pages|landing_pages|tags)-(en|ar)-(\d{1,6})\.xml$/;

export interface ChildSitemap {
  type: SitemapType;
  locale: Locale;
  page: number;
}

export function childSitemapName({ type, locale, page }: ChildSitemap): string {
  return `${type}-${locale}-${page}.xml`;
}

/** `products-en-2.xml` → its type, language and page; null for anything else. */
export function parseChildSitemapName(name: string): ChildSitemap | null {
  const match = NAME.exec(name);
  if (!match) return null;
  const page = Number(match[3]);
  return page >= 1 ? { type: match[1] as SitemapType, locale: match[2] as Locale, page } : null;
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The sitemap index: one child per type, language and page. */
export function sitemapIndexXml(origin: string, children: readonly ChildSitemap[]): string {
  const rows = children.map((child) => `  <sitemap><loc>${escapeXml(`${origin}/sitemaps/${childSitemapName(child)}`)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</sitemapindex>\n`;
}

function url(origin: string, target: SitemapEntry['target'], locale: Locale): string | null {
  const link = resolveTarget(target, locale);
  return link && !link.external ? origin + link.href : null;
}

/** One child sitemap: the entries' URLs in `locale`, each with its xhtml:link alternates. */
export function urlSetXml(origin: string, locale: Locale, entries: readonly SitemapEntry[]): string {
  const rows: string[] = [];
  for (const entry of entries) {
    const loc = url(origin, entry.target, locale);
    if (!loc) continue;
    const alternates = entry.alternates
      .map((alternate) => ({ locale: alternate.locale, href: url(origin, alternate.target, alternate.locale) }))
      .filter((alternate): alternate is { locale: Locale; href: string } => alternate.href !== null)
      .map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.locale}" href="${escapeXml(alternate.href)}"/>`);
    const lastmod = entry.updatedAt ? `    <lastmod>${escapeXml(entry.updatedAt)}</lastmod>\n` : '';
    rows.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod}${alternates.join('\n')}${alternates.length ? '\n' : ''}  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

export function xmlResponse(xml: string, status = 200): Response {
  return new Response(xml, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
