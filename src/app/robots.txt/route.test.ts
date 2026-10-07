import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSiteSeo } from '@/lib/seo.server';
import { siteSeoFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn() }));

const robots = async () => (await GET()).text();

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSiteSeo).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('robots.txt', () => {
  it('keeps the private pages of both languages and the API out, and points at the sitemap index of this origin', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    const body = await robots();

    expect(body).toMatch(/^User-agent: \*\nAllow: \/\n/);
    for (const path of ['/en/cart', '/ar/cart', '/en/checkout', '/ar/account', '/en/orders', '/en/session', '/ar/favorites', '/en/verify-phone', '/api/']) {
      expect(body).toContain(`Disallow: ${path}\n`);
    }
    expect(body).toContain('Sitemap: https://shop.test/sitemap_index.xml\n');
  });

  it('serves ROBOTS_TXT as it is, like the old storefront deploy', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    vi.stubEnv('ROBOTS_TXT', 'User-agent: *\r\nDisallow: /*/checkout$\r\n');
    expect(await robots()).toBe('User-agent: *\nDisallow: /*/checkout$\n');
  });

  it('disallows everything when the backend says the store may not be indexed, ROBOTS_TXT or not', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue({ ...siteSeoFixture(), robots: { index: false } });
    vi.stubEnv('ROBOTS_TXT', 'User-agent: *\nAllow: /\n');
    expect(await robots()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('stays indexable when the backend cannot be reached (a blip must not de-index the store)', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(null);
    const body = await robots();
    expect(body).toContain('Allow: /\n');
    expect(body).toContain('Sitemap: https://shop.test/sitemap_index.xml');
  });
});
