import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { createStorefrontClient } from './http';
import { getHome, getLayout } from './storefront';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('storefront client', () => {
  it('sends locale and api-key, returns data', async () => {
    const fetch = mockFetch(200, { data: { sections: [] } });
    const client = createStorefrontClient({ baseUrl: 'https://api.test/', apiKey: 'k', fetch });

    await expect(getHome(client, 'ar')).resolves.toEqual({ sections: [] });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/customer/v3/home');
    expect(init?.headers).toMatchObject({ 'Accept-Language': 'ar', 'api-key': 'k' });
  });

  it('turns HTTP errors into named errors', async () => {
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(500, { error: { code: 'server_error', message: 'Down' } }) });
    const error = await getLayout(client, 'en').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'server', code: 500, message: 'Down' });
  });

  it('maps 404 to not_found', async () => {
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(404, { error: { code: 'not_found', message: 'Nope' } }) });
    await expect(getLayout(client, 'en')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('rejects bodies that are not the v3 envelope', async () => {
    const legacy = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(200, { code: 200, message: 'Success' }) });
    await expect(getHome(legacy, 'en')).rejects.toMatchObject({ kind: 'invalid_response' });

    const html = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(200, '<html>') });
    await expect(getHome(html, 'en')).rejects.toMatchObject({ kind: 'invalid_response' });
  });

  it('reports network failures', async () => {
    const client = createStorefrontClient({
      baseUrl: 'https://api.test',
      fetch: vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    });
    await expect(getHome(client, 'en')).rejects.toMatchObject({ kind: 'network' });
  });
});
