import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SitemapPage } from '@/sdk';
import { loadSiteSeo, loadSitemapPage } from '@/lib/seo.server';
import { siteSeoFixture, sitemapProductsFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn(), loadSitemapPage: vi.fn() }));

const empty = (): SitemapPage => ({ ...sitemapProductsFixture(), items: [], pagination: { page: 1, perPage: 1000, total: 0, totalPages: 0 } });

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSiteSeo).mockReset().mockResolvedValue(siteSeoFixture());
  vi.mocked(loadSitemapPage).mockReset();
});

describe('GET /sitemap.xml (index)', () => {
  it('lists one child per type, language and page the backend reports, under this origin', async () => {
    vi.mocked(loadSitemapPage).mockImplementation(async (locale, type) =>
      type === 'products' ? { ...sitemapProductsFixture(locale), pagination: { page: 1, perPage: 1000, total: 1500, totalPages: 2 } } : empty(),
    );
    const response = await GET();
    const xml = await response.text();

    expect(response.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(xml.match(/<loc>[^<]+<\/loc>/g)).toEqual([
      '<loc>https://shop.test/sitemaps/products-en-1.xml</loc>',
      '<loc>https://shop.test/sitemaps/products-en-2.xml</loc>',
      '<loc>https://shop.test/sitemaps/products-ar-1.xml</loc>',
      '<loc>https://shop.test/sitemaps/products-ar-2.xml</loc>',
    ]);
    expect(vi.mocked(loadSitemapPage).mock.calls.every(([, , page, perPage]) => page === 1 && perPage === 1000)).toBe(true);
  });

  it('lists nothing for a store the backend hides from search engines (and asks for no pages)', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue({ ...siteSeoFixture(), robots: { index: false } });
    const xml = await (await GET()).text();
    expect(xml).not.toContain('<sitemap>');
    expect(loadSitemapPage).not.toHaveBeenCalled();
  });

  it('skips a type whose first page failed to load', async () => {
    vi.mocked(loadSitemapPage).mockImplementation(async (locale, type) => (type === 'brands' ? null : type === 'tags' ? sitemapProductsFixture(locale) : empty()));
    const xml = await (await GET()).text();
    expect(xml).not.toContain('brands-');
    expect(xml).toContain('<loc>https://shop.test/sitemaps/tags-en-1.xml</loc>');
  });
});
