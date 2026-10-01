import { headers } from 'next/headers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSiteSeo } from '@/lib/seo.server';
import { siteSeoFixture } from '@/test/seo-fixtures';
import robots from './robots';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn() }));

beforeEach(() => {
  vi.mocked(headers).mockResolvedValue(new Headers({ host: 'shop.test', 'x-forwarded-proto': 'https' }) as never);
  vi.mocked(loadSiteSeo).mockReset();
});

describe('robots.txt', () => {
  it('keeps the private pages of both languages and the API out, and points at the sitemap of this origin', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    const answer = await robots();

    expect(answer.sitemap).toBe('https://shop.test/sitemap.xml');
    const rules = answer.rules as { userAgent: string; allow: string; disallow: string[] };
    expect(rules).toMatchObject({ userAgent: '*', allow: '/' });
    expect(rules.disallow).toEqual(expect.arrayContaining(['/en/cart', '/ar/cart', '/en/checkout', '/ar/account', '/en/sign-in', '/api/']));
  });

  it('disallows everything when the backend says the store may not be indexed', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue({ ...siteSeoFixture(), robots: { index: false } });
    expect(await robots()).toEqual({ rules: { userAgent: '*', disallow: '/' } });
  });

  it('stays indexable when the backend cannot be reached (a blip must not de-index the store)', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(null);
    const answer = await robots();
    expect((answer.rules as { allow: string }).allow).toBe('/');
    expect(answer.sitemap).toBe('https://shop.test/sitemap.xml');
  });
});
