import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHome } from '@/sdk';
import { storefrontClient } from './storefront.server';

vi.mock('next/headers', () => ({ cookies: vi.fn() }));

type NextInit = RequestInit & { next?: { revalidate: number } };

async function homeRequest(): Promise<NextInit> {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ data: { sections: [] } }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await getHome(storefrontClient(), 'en');
  return fetch.mock.calls[0][1] as NextInit;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('storefrontClient: editor preview', () => {
  it('a normal site: no preview header, store content cached', async () => {
    vi.stubEnv('SC_API_URL', 'https://api.test');
    vi.stubEnv('SC_PREVIEW_TOKEN', '');
    const init = await homeRequest();
    expect(init.headers).not.toHaveProperty('x-preview-token');
    expect(init.next).toEqual({ revalidate: 60 });
  });

  it('SC_PREVIEW_TOKEN set (an editor preview): sends it as x-preview-token, never cached', async () => {
    vi.stubEnv('SC_API_URL', 'https://api.test');
    vi.stubEnv('SC_PREVIEW_TOKEN', 'hmac-of-section-drafts');
    const init = await homeRequest();
    expect(init.headers).toMatchObject({ 'x-preview-token': 'hmac-of-section-drafts' });
    expect(init.cache).toBe('no-store');
    expect(init.next).toBeUndefined();
  });
});
