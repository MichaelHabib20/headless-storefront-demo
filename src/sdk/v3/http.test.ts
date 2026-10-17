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

describe('storefront client: checkout errors and uploads', () => {
  it('keeps what the backend sent next to the error (the fresh checkout)', async () => {
    const body = { error: { code: 'total_changed', message: 'The total changed.' }, checkout: { canPlaceOrder: true } };
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(409, body) });

    const error = await client.request('POST', 'orders', { locale: 'en', token: 't', body: {} }).catch((e) => e);

    expect(error).toMatchObject({ kind: 'total_changed', code: 409, message: 'The total changed.', details: { checkout: { canPlaceOrder: true } } });
  });

  it('sends booleans in the query and leaves out empty values', async () => {
    const fetch = mockFetch(200, { data: {} });
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch });

    await client.request('GET', 'products', { locale: 'en', query: { deals: true, q: undefined, brand: null, page: 2 } });

    expect(fetch.mock.calls[0][0]).toBe('https://api.test/api/customer/v3/products?deals=true&page=2');
  });

  it('uploads a file as form data without a JSON content type', async () => {
    const fetch = mockFetch(201, { data: { id: 'f1', name: 'rx.png' } });
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch });
    const form = new FormData();
    form.set('file', new Blob(['x'], { type: 'image/png' }), 'rx.png');

    await expect(client.upload('uploads', { locale: 'ar', token: 't', form })).resolves.toEqual({ id: 'f1', name: 'rx.png' });

    const init = fetch.mock.calls[0][1];
    expect(init?.body).toBe(form);
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer t', 'Accept-Language': 'ar' });
    expect(init?.headers).not.toHaveProperty('Content-Type');
  });
});

describe('onTokenRefused', () => {
  const refused = { error: { code: 'unauthenticated', message: 'Please start a session first.' } };

  it('tells the app which token the backend refused (401), then throws as before', async () => {
    const onTokenRefused = vi.fn();
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(401, refused), onTokenRefused });
    await expect(client.request('GET', 'cart', { locale: 'en', token: 'revoked.token' })).rejects.toMatchObject({ kind: 'unauthenticated' });
    expect(onTokenRefused).toHaveBeenCalledWith('revoked.token');
  });

  it('is not called without a token, for other failures, or for wrong credentials', async () => {
    const onTokenRefused = vi.fn();
    const call = (status: number, body: unknown, token: string | null) =>
      createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(status, body), onTokenRefused }).request('GET', 'me', { locale: 'en', token }).catch(() => null);
    await call(401, refused, null);
    await call(500, { error: { code: 'server_error', message: 'Down' } }, 't.1');
    await call(401, { error: { code: 'invalid_credentials', message: 'Wrong password' } }, 't.1');
    expect(onTokenRefused).not.toHaveBeenCalled();
  });

  it('its own failure never hides the 401', async () => {
    const client = createStorefrontClient({ baseUrl: 'https://api.test', fetch: mockFetch(401, refused), onTokenRefused: () => Promise.reject(new Error('read-only cookies')) });
    await expect(client.request('GET', 'cart', { locale: 'en', token: 't.1' })).rejects.toMatchObject({ kind: 'unauthenticated' });
  });
});
