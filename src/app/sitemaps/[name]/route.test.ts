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

describe('GET /sitemaps/<type>-<locale>-<page>.xml', () => {
  it('writes the page of that type in that language, every URL with both languages', async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('ar'));
    const response = await get('products-ar-2.xml');
    const xml = await response.text();

    expect(loadSitemapPage).toHaveBeenCalledWith('ar', 'products', 2, 1000);
    expect(response.status).toBe(200);
    const first = sitemapProductsFixture('ar').items[0];
    expect(xml).toContain('<loc>https://shop.test/ar/p/');
    expect(xml).toContain(`<lastmod>${first.updatedAt}</lastmod>`);
    expect(xml).toContain('hreflang="en" href="https://shop.test/en/p/');
    expect(xml).toContain('hreflang="ar" href="https://shop.test/ar/p/');
  });

  it('answers 404 for names that are not ours and pages past the end, without guessing', async () => {
    expect((await get('products-fr-1.xml')).status).toBe(404);
    expect((await get('../secrets.xml')).status).toBe(404);
    expect((await get('products-en-0.xml')).status).toBe(404);
    expect(loadSitemapPage).not.toHaveBeenCalled();

    vi.mocked(loadSitemapPage).mockResolvedValue(sitemapProductsFixture('en'));
    expect((await get('products-en-9.xml')).status).toBe(404);
  });

  it('answers 503 with Retry-After when the backend cannot be reached', async () => {
    vi.mocked(loadSitemapPage).mockResolvedValue(null);
    const response = await get('categories-en-1.xml');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('60');
  });
});
