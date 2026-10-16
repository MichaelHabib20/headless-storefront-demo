/**
 * Sitemap XML (sitemaps.org) from the backend's `GET /sitemap` entries. The backend lists what
 * exists (Targets, dates, both languages, the old storefront's file types); this file only turns
 * Targets into URLs of this storefront (the public origin: SC_SITE_URL, else the request's) and
 * writes the XML. No I/O of its own (the loader is passed in).
 *
 * The old storefront's file names (its backend wrote them; Search Console knows them):
 *   /sitemap_index.xml                     → index of the child sitemaps (also /sitemap.xml)
 *   /sitemap_<type>_<locale>[_<n>].xml     → one file of one type and language: up to 50,000 URLs
 *                                            (the old `sitemap.max_urls`), every entry with its
 *                                            hreflang alternates; the first file has no number,
 *                                            the next ones _1, _2... like the old command wrote them
 * Served from /sitemaps/<name> through the rewrites in next.config.mjs.
 */
import type { Locale, SitemapEntry, SitemapPage, SitemapType } from '@/sdk';
import { resolveCategoryView, resolveTarget } from './routing';

/** The old index's order (static pages, pages, products, the category tree...), then the types it had behind settings. */
export const SITEMAP_TYPES: readonly SitemapType[] = ['static_pages', 'pages', 'products', 'categories', 'subcategories', 'groups', 'brands', 'landing_pages', 'tags'];
/** Languages in the old index's order (Arabic first). */
export const SITEMAP_LOCALES: readonly Locale[] = ['ar', 'en'];
/** URLs per child sitemap: the protocol's maximum and the old `sitemap.max_urls`. */
export const SITEMAP_FILE_SIZE = 50_000;
/** Entries per backend request (the contract's maximum perPage). */
export const SITEMAP_API_PAGE_SIZE = 5_000;
const API_PAGES_PER_FILE = SITEMAP_FILE_SIZE / SITEMAP_API_PAGE_SIZE;

const NAME = new RegExp(`^sitemap_(${SITEMAP_TYPES.join('|')})_(en|ar)(?:_([1-9]\\d{0,5}))?\\.xml$`);

export interface ChildSitemap {
  type: SitemapType;
  locale: Locale;
  /** 1 = the file without a number, 2 = `_1`... */
  page: number;
}

export function childSitemapName({ type, locale, page }: ChildSitemap): string {
  return page > 1 ? `sitemap_${type}_${locale}_${page - 1}.xml` : `sitemap_${type}_${locale}.xml`;
}

/** `sitemap_products_en_1.xml` → its type, language and file (2); null for anything else. */
export function parseChildSitemapName(name: string): ChildSitemap | null {
  const match = NAME.exec(name);
  if (!match) return null;
  return { type: match[1] as SitemapType, locale: match[2] as Locale, page: match[3] ? Number(match[3]) + 1 : 1 };
}

/** How many child files `total` entries make (0 for none). */
export function sitemapFileCount(total: number): number {
  return Math.ceil(Math.max(0, total) / SITEMAP_FILE_SIZE);
}

type PageLoader = (locale: Locale, type: SitemapType, page: number, perPage: number) => Promise<SitemapPage | null>;

/**
 * The entries of one child file: backend pages of 5,000, ten per file, asked together after the
 * first (which tells how many there are). null when any of them fails (the file is then
 * unavailable rather than silently short); `missing` for a file past the end.
 */
export async function loadSitemapFile(load: PageLoader, { type, locale, page }: ChildSitemap): Promise<SitemapEntry[] | 'missing' | null> {
  const first = (page - 1) * API_PAGES_PER_FILE + 1;
  const head = await load(locale, type, first, SITEMAP_API_PAGE_SIZE);
  if (!head) return null;
  if (page > Math.max(1, sitemapFileCount(head.pagination.total))) return 'missing';
  const last = Math.min(first + API_PAGES_PER_FILE - 1, head.pagination.totalPages);
  const rest = await Promise.all(Array.from({ length: Math.max(0, last - first) }, (_, i) => load(locale, type, first + 1 + i, SITEMAP_API_PAGE_SIZE)));
  if (rest.some((part) => !part)) return null;
  return [head, ...(rest as SitemapPage[])].flatMap((part) => part.items);
}

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The sitemap index: one child per type, language and file. */
export function sitemapIndexXml(origin: string, children: readonly ChildSitemap[]): string {
  const rows = children.map((child) => `  <sitemap><loc>${escapeXml(`${origin}/${childSitemapName(child)}`)}</loc></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</sitemapindex>\n`;
}

/**
 * The URL of an entry's Target in `locale`. A category the store lists at the old category view
 * (`categoryView`) is at /category/..., not at its listing.
 */
function url(origin: string, entry: SitemapEntry, target: SitemapEntry['target'], locale: Locale): string | null {
  const link = (entry.categoryView ? resolveCategoryView(target, locale) : null) ?? resolveTarget(target, locale);
  return link && !link.external ? origin + link.href : null;
}

/** One child sitemap: the entries' URLs in `locale`, each with its xhtml:link alternates (x-default: the Arabic page). */
export function urlSetXml(origin: string, locale: Locale, entries: readonly SitemapEntry[]): string {
  const rows: string[] = [];
  for (const entry of entries) {
    const loc = url(origin, entry, entry.target, locale);
    if (!loc) continue;
    const alternates = entry.alternates
      .map((alternate) => ({ hreflang: alternate.locale as string, href: url(origin, entry, alternate.target, alternate.locale) }))
      .filter((alternate): alternate is { hreflang: string; href: string } => alternate.href !== null);
    const arabic = alternates.find((alternate) => alternate.hreflang === 'ar');
    if (arabic) alternates.push({ hreflang: 'x-default', href: arabic.href });
    const links = alternates.map((alternate) => `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" href="${escapeXml(alternate.href)}"/>`);
    const lastmod = entry.updatedAt ? `    <lastmod>${escapeXml(entry.updatedAt)}</lastmod>\n` : '';
    rows.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n${lastmod}${links.join('\n')}${links.length ? '\n' : ''}  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join('\n')}\n</urlset>\n`;
}

export function xmlResponse(xml: string, status = 200): Response {
  return new Response(xml, { status, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
