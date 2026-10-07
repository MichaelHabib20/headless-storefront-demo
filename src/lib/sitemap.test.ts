import { describe, expect, it } from 'vitest';
import type { SitemapEntry } from '@/sdk';
import { sitemapProductsFixture } from '@/test/seo-fixtures';
import { childSitemapName, parseChildSitemapName, sitemapIndexXml, urlSetXml } from './sitemap';

describe('sitemap XML', () => {
  it('names child sitemaps by type, language and page, and refuses anything else', () => {
    expect(childSitemapName({ type: 'landing_pages', locale: 'ar', page: 3 })).toBe('sitemap_landing_pages_ar_3.xml');
    expect(childSitemapName({ type: 'products', locale: 'en', page: 1 })).toBe('sitemap_products_en.xml');
    expect(parseChildSitemapName('sitemap_landing_pages_ar_3.xml')).toEqual({ type: 'landing_pages', locale: 'ar', page: 3 });
    expect(parseChildSitemapName('sitemap_products_en.xml')).toEqual({ type: 'products', locale: 'en', page: 1 });
    for (const bad of ['sitemap_orders_en.xml', 'sitemap_products_fr.xml', 'sitemap_products_en_0.xml', 'sitemap_products_en_1.xml', 'sitemap_products_en.json', '../sitemap_products_en.xml', 'sitemap_products_en.xml/x', 'products-en-1.xml']) {
      expect(parseChildSitemapName(bad)).toBeNull();
    }
  });

  it('writes the index under the request origin', () => {
    expect(sitemapIndexXml('https://shop.test', [{ type: 'products', locale: 'en', page: 1 }, { type: 'products', locale: 'ar', page: 2 }])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <sitemap><loc>https://shop.test/sitemap_products_en.xml</loc></sitemap>\n' +
        '  <sitemap><loc>https://shop.test/sitemap_products_ar_2.xml</loc></sitemap>\n</sitemapindex>\n',
    );
  });

  it('writes each entry with its date and both languages, escaped', () => {
    const xml = urlSetXml('http://127.0.0.1:3302', 'ar', sitemapProductsFixture('ar').items);
    const entries = xml.match(/<url>/g) ?? [];
    expect(entries).toHaveLength(sitemapProductsFixture('ar').items.length);
    expect(xml).toContain('<lastmod>2026-09-01T10:00:00+03:00</lastmod>');
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="en" href="http:\/\/127\.0\.0\.1:3302\/en\/[^"/]+"\/>/);
    expect(xml).toMatch(/<loc>http:\/\/127\.0\.0\.1:3302\/ar\/%D8/);

    const odd: SitemapEntry[] = [
      { target: { type: 'search', query: 'a&b<c' }, updatedAt: null, alternates: [] },
      { target: { type: 'url', url: 'https://elsewhere.test' }, updatedAt: null, alternates: [] },
    ];
    const oddXml = urlSetXml('https://shop.test', 'en', odd);
    expect(oddXml).toContain('<loc>https://shop.test/en/products?search=a%26b%3Cc</loc>');
    expect(oddXml).not.toContain('elsewhere');
    expect(oddXml).not.toContain('<lastmod>');
  });
});
