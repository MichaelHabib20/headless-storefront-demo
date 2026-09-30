import { describe, expect, it, vi } from 'vitest';
import { createStorefrontClient } from './http';
import { getCheckoutSettings, getLocations } from './settings';

function clientReturning(data: unknown) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => new Response(JSON.stringify({ data }), { status: 200 }));
  return { fetch, client: createStorefrontClient({ baseUrl: 'https://api.test', fetch }) };
}

describe('settings SDK', () => {
  it('reads the checkout settings without a token', async () => {
    const { fetch, client } = clientReturning({ addressForm: { levels: ['city'], fields: [{ name: 'street', label: 'Street', required: true, kind: 'text' }] } });

    const settings = await getCheckoutSettings(client, 'en');

    expect(settings.addressForm.fields[0].name).toBe('street');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/customer/v3/checkout/settings');
    expect(init?.headers).not.toHaveProperty('Authorization');
  });

  it('reads the locations in the request language', async () => {
    const { fetch, client } = clientReturning({ cities: [{ id: 1, name: 'القاهرة', areas: [] }] });

    const result = await getLocations(client, 'ar');

    expect(result.cities[0].name).toBe('القاهرة');
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.test/api/customer/v3/locations');
    expect(init?.headers).toMatchObject({ 'Accept-Language': 'ar' });
  });
});
