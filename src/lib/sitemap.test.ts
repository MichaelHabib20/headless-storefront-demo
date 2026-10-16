import { describe, expect, it, vi } from 'vitest';
import type { Locale, SitemapEntry, SitemapPage, SitemapType } from '@/sdk';
import { sitemapProductsFixture } from '@/test/seo-fixtures';
import { childSitemapName, loadSitemapFile, parseChildSitemapName, sitemapFileCount, sitemapIndexXml, urlSetXml } from './sitemap';

describe('sitemap XML', () => {
  it("names child sitemaps like the old storefront (first file without a number, then _1, _2...), and refuses anything else", () => {
    expect(childSitemapName({ type: 'landing_pages', locale: 'ar', page: 3 })).toBe('sitemap_landing_pages_ar_2.xml');
    expect(childSitemapName({ type: 'products', locale: 'en', page: 1 })).toBe('sitemap_products_en.xml');
    expect(childSitemapName({ type: 'static_pages', locale: 'ar', page: 1 })).toBe('sitemap_static_pages_ar.xml');
    expect(parseChildSitemapName('sitemap_landing_pages_ar_2.xml')).toEqual({ type: 'landing_pages', locale: 'ar', page: 3 });
    expect(parseChildSitemapName('sitemap_products_en_1.xml')).toEqual({ type: 'products', locale: 'en', page: 2 });
    expect(parseChildSitemapName('sitemap_products_en.xml')).toEqual({ type: 'products', locale: 'en', page: 1 });
    for (const type of ['static_pages', 'pages', 'products', 'categories', 'subcategories', 'groups', 'brands', 'landing_pages', 'tags']) {
      expect(parseChildSitemapName(`sitemap_${type}_ar.xml`)).toEqual({ type, locale: 'ar', page: 1 });
    }
    for (const bad of ['sitemap_orders_en.xml', 'sitemap_products_fr.xml', 'sitemap_products_en_0.xml', 'sitemap_products_en_01.xml', 'sitemap_products_en.json', '../sitemap_products_en.xml', 'sitemap_products_en.xml/x', 'products-en-1.xml', 'sitemap_en.xml']) {
      expect(parseChildSitemapName(bad)).toBeNull();
    }
    expect(sitemapFileCount(0)).toBe(0);
    expect(sitemapFileCount(21_636)).toBe(1);
    expect(sitemapFileCount(50_000)).toBe(1);
    expect(sitemapFileCount(50_001)).toBe(2);
  });

  it('writes the index under the given origin', () => {
    expect(sitemapIndexXml('https://shop.test', [{ type: 'products', locale: 'en', page: 1 }, { type: 'products', locale: 'ar', page: 2 }])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <sitemap><loc>https://shop.test/sitemap_products_en.xml</loc></sitemap>\n' +
        '  <sitemap><loc>https://shop.test/sitemap_products_ar_1.xml</loc></sitemap>\n</sitemapindex>\n',
    );
  });

  it('loads one file as backend pages of 5,000 (up to ten), or nothing when one of them fails', async () => {
    const page = (n: number, total: number): SitemapPage => ({ items: [{ target: { type: 'product', slug: `p${n}` }, updatedAt: null, alternates: [] }], pagination: { page: n, perPage: 5000, total, totalPages: Math.ceil(total / 5000) } });
    const load = vi.fn(async (_locale: Locale, _type: SitemapType, n: number, _perPage: number) => page(n, 21_636));

    const first = await loadSitemapFile(load, { type: 'products', locale: 'en', page: 1 });
    expect(load.mock.calls.map(([, , n, perPage]) => [n, perPage])).toEqual([1, 2, 3, 4, 5].map((n) => [n, 5000]));
    expect(first).toHaveLength(5);

    load.mockClear();
    expect(await loadSitemapFile(load, { type: 'products', locale: 'en', page: 2 })).toBe('missing');
    expect(load).toHaveBeenCalledTimes(1);

    load.mockImplementation(async (_l, _t, n) => page(n, 150_000));
    load.mockClear();
    expect(await loadSitemapFile(load, { type: 'products', locale: 'en', page: 3 })).toHaveLength(10);
    expect(load.mock.calls.map(([, , n]) => n)).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);

    load.mockImplementation(async (_l, _t, n) => (n === 3 ? null : page(n, 21_636)) as SitemapPage);
    expect(await loadSitemapFile(load, { type: 'products', locale: 'en', page: 1 })).toBeNull();

    load.mockImplementation(async () => page(1, 0));
    expect(await loadSitemapFile(load, { type: 'tags', locale: 'en', page: 1 })).toHaveLength(1);
  });

  it('writes a category the store shows at the old category view at /category/..., in each language', () => {
    const group: SitemapEntry = {
      target: { type: 'category', path: ['mom-baby', 'baby-care'] },
      updatedAt: null,
      categoryView: true,
      alternates: [
        { locale: 'en', target: { type: 'category', path: ['mom-baby', 'baby-care'] } },
        { locale: 'ar', target: { type: 'category', path: ['العناية-بالام-والطفل', 'العناية-بالطفل'] } },
      ],
    };
    const xml = urlSetXml('https://shop.test', 'en', [group, { ...group, categoryView: undefined }]);
    expect(xml).toContain('<loc>https://shop.test/en/category/mom-baby/baby-care</loc>');
    expect(xml).toContain(`hreflang="ar" href="https://shop.test/ar/category/${encodeURIComponent('العناية-بالام-والطفل')}/${encodeURIComponent('العناية-بالطفل')}"`);
    expect(xml).toContain(`hreflang="x-default" href="https://shop.test/ar/category/${encodeURIComponent('العناية-بالام-والطفل')}/`);
    // without the flag: the listing
    expect(xml).toContain('<loc>https://shop.test/en/product/mom-baby/baby-care</loc>');
  });

  it('writes each entry with its date and both languages, escaped', () => {
    const xml = urlSetXml('http://127.0.0.1:3302', 'ar', sitemapProductsFixture('ar').items);
    const entries = xml.match(/<url>/g) ?? [];
    expect(entries).toHaveLength(sitemapProductsFixture('ar').items.length);
    expect(xml).toContain('<lastmod>2026-09-01T10:00:00+03:00</lastmod>');
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="en" href="http:\/\/127\.0\.0\.1:3302\/en\/[^"/]+"\/>/);
    expect(xml).toMatch(/<xhtml:link rel="alternate" hreflang="x-default" href="http:\/\/127\.0\.0\.1:3302\/ar\/[^"/]+"\/>/);
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
