import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SitemapPage } from '@/sdk';
import { loadSiteSeo, loadSitemapPage } from '@/lib/seo.server';
import { siteSeoFixture, sitemapProductsFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn(), loadSitemapPage: vi.fn() }));

const count = (total: number): SitemapPage => ({ ...sitemapProductsFixture(), pagination: { page: 1, perPage: 1, total, totalPages: total } });
const locs = async () => (await (await GET()).text()).match(/<loc>[^<]+<\/loc>/g) ?? [];

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSiteSeo).mockReset().mockResolvedValue(siteSeoFixture());
  vi.mocked(loadSitemapPage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /sitemap_index.xml (and /sitemap.xml)', () => {
  it("lists the old storefront's files in its order (Arabic first), one per 50,000 URLs, empty types left out", async () => {
    const totals: Record<string, number> = { static_pages: 3, pages: 5, products: 21_636, categories: 9, subcategories: 275, groups: 33, brands: 0, landing_pages: 0, tags: 0 };
    vi.mocked(loadSitemapPage).mockImplementation(async (_locale, type) => count(totals[type]));
    const response = await GET();

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect((await response.text()).match(/<loc>[^<]+<\/loc>/g)).toEqual(
      ['static_pages', 'pages', 'products', 'categories', 'subcategories', 'groups'].flatMap((type) => [
        `<loc>https://shop.test/sitemap_${type}_ar.xml</loc>`,
        `<loc>https://shop.test/sitemap_${type}_en.xml</loc>`,
      ]),
    );
    // only the counts are asked: one entry of the first page per type and language
    expect(vi.mocked(loadSitemapPage).mock.calls.every(([, , page, perPage]) => page === 1 && perPage === 1)).toBe(true);
    expect(loadSitemapPage).toHaveBeenCalledTimes(18);
  });

  it('a type past 50,000 URLs gets more files: _1, _2... like the old command named them', async () => {
    vi.mocked(loadSitemapPage).mockImplementation(async (locale, type) => count(type === 'products' && locale === 'en' ? 120_000 : 0));
    expect(await locs()).toEqual([
      '<loc>https://shop.test/sitemap_products_en.xml</loc>',
      '<loc>https://shop.test/sitemap_products_en_1.xml</loc>',
      '<loc>https://shop.test/sitemap_products_en_2.xml</loc>',
    ]);
  });

  it('uses the canonical origin of SC_SITE_URL on any host', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    vi.mocked(headers).mockResolvedValue(new Headers({ host: 'seif-storefront.vercel.app' }) as never);
    vi.mocked(loadSitemapPage).mockImplementation(async (_locale, type) => count(type === 'pages' ? 5 : 0));
    expect(await locs()).toEqual(['<loc>https://seif-online.com/sitemap_pages_ar.xml</loc>', '<loc>https://seif-online.com/sitemap_pages_en.xml</loc>']);
  });

  it('still lists the files for a store the backend keeps out of search engines (robots.txt blocks crawling there)', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue({ ...siteSeoFixture(), robots: { index: false } });
    vi.mocked(loadSitemapPage).mockImplementation(async (_locale, type) => count(type === 'products' ? 10 : 0));
    expect(await locs()).toEqual(['<loc>https://shop.test/sitemap_products_ar.xml</loc>', '<loc>https://shop.test/sitemap_products_en.xml</loc>']);
  });

  it('skips a type whose count failed to load', async () => {
    vi.mocked(loadSitemapPage).mockImplementation(async (_locale, type) => (type === 'brands' ? null : type === 'tags' ? count(2) : count(0)));
    const all = await locs();
    expect(all.some((loc) => loc.includes('brands'))).toBe(false);
    expect(all).toContain('<loc>https://shop.test/sitemap_tags_en.xml</loc>');
  });
});
