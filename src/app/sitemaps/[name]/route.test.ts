import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSitemapPage } from '@/lib/seo.server';
import { sitemapProductsFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSitemapPage: vi.fn() }));

const get = (name: string) => GET(new Request(`https://shop.test/sitemaps/${name}`), { params: Promise.resolve({ name }) });

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSitemapPage).mockReset();
});

describe('GET /sitemap_<type>_<locale>[_<page>].xml', () => {
  it('writes the page of that type in that language, every URL with both languages', async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('ar'));
    const response = await get('sitemap_products_ar_2.xml');
    const xml = await response.text();

    expect(loadSitemapPage).toHaveBeenCalledWith('ar', 'products', 2, 1000);
    expect(response.status).toBe(200);
    const first = sitemapProductsFixture('ar').items[0];
    expect(xml).toContain('<loc>https://shop.test/ar/');
    expect(xml).toContain(`<lastmod>${first.updatedAt}</lastmod>`);
    expect(xml).toContain('hreflang="en" href="https://shop.test/en/');
    expect(xml).toContain('hreflang="ar" href="https://shop.test/ar/');
  });

  it('answers 404 for names that are not ours and pages past the end, without guessing', async () => {
    expect((await get('sitemap_products_fr.xml')).status).toBe(404);
    expect((await get('../secrets.xml')).status).toBe(404);
    expect((await get('sitemap_products_en_0.xml')).status).toBe(404);
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
