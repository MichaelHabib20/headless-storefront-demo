import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SitemapPage } from '@/sdk';
import { loadSitemapPage } from '@/lib/seo.server';
import { sitemapProductsFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSitemapPage: vi.fn() }));

const get = (name: string) => GET(new Request(`https://shop.test/sitemaps/${name}`), { params: Promise.resolve({ name }) });
const groupsPage = (): SitemapPage => ({
  items: [
    {
      target: { type: 'category', path: ['skin-care', 'العناية-بالجسم'] },
      updatedAt: null,
      categoryView: true,
      alternates: [
        { locale: 'en', target: { type: 'category', path: ['skin-care', 'body-care'] } },
        { locale: 'ar', target: { type: 'category', path: ['skin-care', 'العناية-بالجسم'] } },
      ],
    },
  ],
  pagination: { page: 1, perPage: 5000, total: 1, totalPages: 1 },
});

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSitemapPage).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('GET /sitemap_<type>_<locale>[_<n>].xml', () => {
  it('writes the file of that type in that language, every URL with both languages and x-default', async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('ar'));
    const response = await get('sitemap_products_ar.xml');
    const xml = await response.text();

    expect(loadSitemapPage).toHaveBeenCalledWith('ar', 'products', 1, 5000);
    expect(response.status).toBe(200);
    const first = sitemapProductsFixture('ar').items[0];
    expect(xml).toContain('<loc>https://shop.test/ar/');
    expect(xml).toContain(`<lastmod>${first.updatedAt}</lastmod>`);
    expect(xml).toContain('hreflang="en" href="https://shop.test/en/');
    expect(xml).toContain('hreflang="ar" href="https://shop.test/ar/');
    expect(xml).toContain('hreflang="x-default" href="https://shop.test/ar/');
  });

  it("the old category view: groups at /category/... with each language's own slugs", async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(groupsPage());
    const xml = await (await get('sitemap_groups_ar.xml')).text();
    expect(loadSitemapPage).toHaveBeenCalledWith('ar', 'groups', 1, 5000);
    expect(xml).toContain(`<loc>https://shop.test/ar/category/skin-care/${encodeURIComponent('العناية-بالجسم')}</loc>`);
    expect(xml).toContain('hreflang="en" href="https://shop.test/en/category/skin-care/body-care"');
  });

  it('URLs use the canonical origin of SC_SITE_URL, also on a test host', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    vi.mocked(headers).mockResolvedValue(new Headers({ host: 'seif-storefront.vercel.app' }) as never);
    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('en'));
    const xml = await (await get('sitemap_products_en.xml')).text();
    expect(xml).toContain('<loc>https://seif-online.com/en/');
    expect(xml).not.toContain('vercel.app');
  });

  it('a second file (_1) holds entries 50,001 to 100,000: backend pages 11 to 20', async () => {
    vi.mocked(loadSitemapPage).mockImplementation(async (_locale, _type, page) => ({ ...sitemapProductsFixture('en'), pagination: { page, perPage: 5000, total: 60_000, totalPages: 12 } }));
    expect((await get('sitemap_products_en_1.xml')).status).toBe(200);
    expect(vi.mocked(loadSitemapPage).mock.calls.map(([, , page]) => page)).toEqual([11, 12]);
  });

  it('answers 404 for names that are not ours and files past the end, without guessing', async () => {
    expect((await get('sitemap_products_fr.xml')).status).toBe(404);
    expect((await get('../secrets.xml')).status).toBe(404);
    expect((await get('sitemap_products_en_0.xml')).status).toBe(404);
    expect((await get('sitemap_orders_en.xml')).status).toBe(404);
    expect(loadSitemapPage).not.toHaveBeenCalled();

    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('en'));
    expect((await get('sitemap_products_en_9.xml')).status).toBe(404);
  });

  it('answers 503 with Retry-After when the backend cannot be reached', async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(null);
    const response = await get('sitemap_categories_en.xml');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
