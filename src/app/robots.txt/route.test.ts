import { headers } from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSiteSeo } from '@/lib/seo.server';
import { siteSeoFixture } from '@/test/seo-fixtures';
import { GET } from './route';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn() }));

const robots = async () => (await GET()).text();
const host = (name: string) => vi.mocked(headers).mockResolvedValue(new Headers({ host: name, 'x-forwarded-proto': 'https' }) as never);

beforeEach(() => {
  host('shop.test');
  vi.mocked(loadSiteSeo).mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe('robots.txt', () => {
  it("an indexable store: the old storefront's rules, private sections of every language kept out, the sitemap index of this origin", async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    const body = await robots();

    expect(body).toMatch(/^User-agent: \*\nAllow: \/\*\.css\n/);
    expect(body).not.toContain('Disallow: /\n');
    for (const rule of [
      'Disallow: /*/checkout$',
      'Disallow: /*/checkout/',
      'Disallow: /*/account/',
      'Disallow: /*/cart$',
      'Disallow: /*/favorites/',
      'Disallow: /*/session/',
      'Disallow: /*/orders/',
      'Disallow: /*/prescriptions$',
      'Disallow: /*/verify-phone/',
      'Disallow: /*/add-address/',
      'Disallow: /*/forms/',
      'Disallow: /*/under-construction$',
      'Disallow: /*?*search=',
      'Disallow: /*?*sort=',
      'Disallow: /*?*list_ids=',
      'Disallow: /*?*brands=',
      'Disallow: /*/product/*--',
      'Disallow: /*?*utm_',
      'Disallow: /api/',
    ]) {
      expect(body).toContain(`${rule}\n`);
    }
    expect(body).toMatch(/\nSitemap: https:\/\/shop\.test\/sitemap_index\.xml\n$/);
  });

  it('the canonical host of SC_SITE_URL: the same rules, the sitemap on the canonical origin', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    host('seif-online.com');
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    const body = await robots();
    expect(body).toContain('Disallow: /*/checkout$\n');
    expect(body).toContain('Sitemap: https://seif-online.com/sitemap_index.xml\n');
  });

  it('a test host (not the SC_SITE_URL host) disallows everything, without asking the backend; ROBOTS_TXT or not', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    vi.stubEnv('ROBOTS_TXT', 'User-agent: *\nAllow: /\n');
    host('seif-storefront.vercel.app');
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    expect(await robots()).toBe('User-agent: *\nDisallow: /\n');
    expect(loadSiteSeo).not.toHaveBeenCalled();
  });

  it('serves ROBOTS_TXT as it is, like the old storefront deploy', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(siteSeoFixture());
    vi.stubEnv('ROBOTS_TXT', 'User-agent: *\r\nDisallow: /*/checkout$\r\n');
    expect(await robots()).toBe('User-agent: *\nDisallow: /*/checkout$\n');
  });

  it('disallows everything when the backend says the store may not be indexed (staging, DISABLE_SEARCH_ENGINE_INDEXING), ROBOTS_TXT or not', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue({ ...siteSeoFixture(), robots: { index: false } });
    vi.stubEnv('ROBOTS_TXT', 'User-agent: *\nAllow: /\n');
    expect(await robots()).toBe('User-agent: *\nDisallow: /\n');
    vi.stubEnv('SC_SITE_URL', 'https://shop.test');
    expect(await robots()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('stays indexable when the backend cannot be reached (a blip must not de-index the store)', async () => {
    vi.mocked(loadSiteSeo).mockResolvedValue(null);
    const body = await robots();
    expect(body).toContain('Allow: /*.css\n');
    expect(body).toContain('Sitemap: https://shop.test/sitemap_index.xml');
  });
});
