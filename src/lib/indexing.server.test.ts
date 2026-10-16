import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSiteSeo } from '@/lib/seo.server';
import { siteSeoFixture } from '@/test/seo-fixtures';
import { backendAllowsIndexing, clearIndexingAnswer, shouldNoindex } from './indexing.server';

vi.mock('@/lib/seo.server', () => ({ loadSiteSeo: vi.fn() }));

const on = (host: string) => new Headers({ host, 'x-forwarded-proto': 'https' });
const backend = (index: boolean | null) => vi.mocked(loadSiteSeo).mockResolvedValue(index === null ? null : { ...siteSeoFixture(), robots: { index } });

beforeEach(() => {
  clearIndexingAnswer();
  vi.mocked(loadSiteSeo).mockReset();
  vi.stubEnv('SC_REVALIDATE_SECONDS', '0');
});
afterEach(() => vi.unstubAllEnvs());

describe('X-Robots-Tag noindex: every combination of SC_SITE_URL, host and the backend', () => {
  const PUBLIC = ['/en', '/ar', '/en/brands', '/ar/product/skin-care', '/en/some-product'];

  it('SC_SITE_URL set, production host, backend allows indexing → indexable (a real store is never noindexed by accident)', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    backend(true);
    for (const path of PUBLIC) expect(await shouldNoindex(path, on('seif-online.com')), path).toBe(false);
  });

  it('SC_SITE_URL set, production host, backend says no indexing → noindex', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    backend(false);
    for (const path of PUBLIC) expect(await shouldNoindex(path, on('seif-online.com')), path).toBe(true);
  });

  it('SC_SITE_URL set, another host (vercel alias, preview) → noindex without asking the backend', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    backend(true);
    for (const path of PUBLIC) expect(await shouldNoindex(path, on('seif-storefront.vercel.app')), path).toBe(true);
    expect(loadSiteSeo).not.toHaveBeenCalled();
  });

  it('SC_SITE_URL not set, backend says no indexing (the seif test host on staging) → noindex', async () => {
    vi.stubEnv('SC_SITE_URL', '');
    backend(false);
    for (const path of PUBLIC) expect(await shouldNoindex(path, on('seif-storefront.vercel.app')), path).toBe(true);
  });

  it('SC_SITE_URL not set, backend allows indexing → indexable (only the backend decides)', async () => {
    vi.stubEnv('SC_SITE_URL', '');
    backend(true);
    for (const path of PUBLIC) expect(await shouldNoindex(path, on('shop.example.com')), path).toBe(false);
  });

  it('the backend cannot be reached → indexable, with or without SC_SITE_URL (a blip must not de-index a live store)', async () => {
    backend(null);
    expect(await shouldNoindex('/en', on('shop.example.com'))).toBe(false);
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    expect(await shouldNoindex('/en', on('seif-online.com'))).toBe(false);
  });

  it("the shopper's private pages are always noindex, whatever the backend says", async () => {
    vi.stubEnv('SC_SITE_URL', 'https://seif-online.com');
    backend(true);
    for (const path of ['/en/cart', '/ar/checkout', '/en/account/order-history', '/en/session/signin', '/ar/verify-phone']) {
      expect(await shouldNoindex(path, on('seif-online.com')), path).toBe(true);
    }
    expect(loadSiteSeo).not.toHaveBeenCalled();
  });
});

describe("the backend's answer", () => {
  it('is reused for SC_REVALIDATE_SECONDS, and not at all with 0', async () => {
    backend(false);
    expect(await backendAllowsIndexing()).toBe(false);
    backend(true);
    expect(await backendAllowsIndexing()).toBe(true);

    vi.stubEnv('SC_REVALIDATE_SECONDS', '60');
    clearIndexingAnswer();
    vi.mocked(loadSiteSeo).mockClear();
    backend(false);
    expect(await backendAllowsIndexing()).toBe(false);
    backend(true);
    expect(await backendAllowsIndexing()).toBe(false);
    expect(loadSiteSeo).toHaveBeenCalledTimes(1);
  });

  it('a failed call is not reused: the next request asks again', async () => {
    vi.stubEnv('SC_REVALIDATE_SECONDS', '60');
    backend(null);
    expect(await backendAllowsIndexing()).toBe(true);
    backend(false);
    expect(await backendAllowsIndexing()).toBe(false);
  });
});
