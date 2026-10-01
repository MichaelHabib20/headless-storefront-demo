import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { getBranches, getForm, getLandingPage, getPage, sendContactMessage, setArea, submitForm } from './content';
import { createStorefrontClient } from './http';

const ROOT = 'https://api.test/api/customer/v3/';

function client(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  return { fetch, client: createStorefrontClient({ baseUrl: 'https://api.test', fetch }) };
}

const sent = (fetch: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(String(init.body)) : undefined, headers: init.headers as Record<string, string> };
};

describe('content SDK', () => {
  it('reads pages, branches, landing pages and forms by slug (encoded)', async () => {
    const { fetch, client: api } = client(200, { data: {} });
    await getPage(api, 'ar', 'من-نحن');
    await getBranches(api, 'en');
    await getLandingPage(api, 'en', 'summer-sale');
    await getForm(api, 'en', 'feedback');
    expect(fetch.mock.calls.map((call) => (call as unknown[])[0])).toEqual([
      `${ROOT}pages/${encodeURIComponent('من-نحن')}`,
      `${ROOT}branches`,
      `${ROOT}landing-pages/summer-sale`,
      `${ROOT}forms/feedback`,
    ]);
  });

  it('sends the contact message without a token, values wrapped', async () => {
    const { fetch, client: api } = client(201, { data: { message: 'Thanks' } });
    await expect(sendContactMessage(api, 'en', { name: 'A', phone: '1', message: 'Hi' })).resolves.toEqual({ message: 'Thanks' });
    const request = sent(fetch);
    expect([request.url, request.method, request.body]).toEqual([`${ROOT}contact`, 'POST', { values: { name: 'A', phone: '1', message: 'Hi' } }]);
    expect(request.headers.Authorization).toBeUndefined();
  });

  it('answers a form and sets the area with the shopper token', async () => {
    const { fetch, client: api } = client(201, { data: { message: 'Thanks' } });
    await submitForm(api, { locale: 'en', token: 'guest-1' }, 'feedback', { field1: 'obour', field2: ['a', 'b'] });
    expect(sent(fetch)).toMatchObject({ url: `${ROOT}forms/feedback/responses`, method: 'POST', body: { values: { field1: 'obour', field2: ['a', 'b'] } } });
    expect(sent(fetch).headers.Authorization).toBe('Bearer guest-1');

    const area = client(200, { data: { authenticated: true } });
    await setArea(area.client, { locale: 'ar', token: 't' }, 11);
    expect(sent(area.fetch)).toMatchObject({ url: `${ROOT}me/area`, method: 'PUT', body: { areaId: 11 } });
  });

  it('a 503 store_unavailable is its own error kind with the merchant message', async () => {
    const { client: api } = client(503, { error: { code: 'store_unavailable', message: 'We are upgrading — back shortly.' } });
    const error = await getPage(api, 'en', 'x').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'store_unavailable', code: 503, message: 'We are upgrading — back shortly.' });
  });
});
