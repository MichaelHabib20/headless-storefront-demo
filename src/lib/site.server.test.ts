import { headers } from 'next/headers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkoutReturnUrl, siteOrigin } from './site.server';

vi.mock('next/headers', () => ({ headers: vi.fn() }));

function request(values: Record<string, string>) {
  vi.mocked(headers).mockResolvedValue(new Headers(values) as unknown as Awaited<ReturnType<typeof headers>>);
}

describe('siteOrigin', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.mocked(headers).mockReset();
  });

  it('uses the origin of the request (a server action is a POST from our own page)', async () => {
    request({ origin: 'https://shop.example.com', host: 'internal:3000' });
    await expect(siteOrigin()).resolves.toBe('https://shop.example.com');
  });

  it('falls back to the forwarded host and protocol, then to the host', async () => {
    request({ 'x-forwarded-host': 'shop.example.com, proxy.internal', 'x-forwarded-proto': 'https, http', host: 'internal:3000' });
    await expect(siteOrigin()).resolves.toBe('https://shop.example.com');

    request({ host: 'shop.example.com' });
    await expect(siteOrigin()).resolves.toBe('https://shop.example.com');

    request({ host: '127.0.0.1:3212' });
    await expect(siteOrigin()).resolves.toBe('http://127.0.0.1:3212');
  });

  it('SC_SITE_URL wins over the request', async () => {
    vi.stubEnv('SC_SITE_URL', 'https://www.shop.example.com/');
    request({ origin: 'https://other.example.com' });
    await expect(siteOrigin()).resolves.toBe('https://www.shop.example.com');
    expect(headers).not.toHaveBeenCalled();
  });

  it('gives nothing rather than a broken or unsafe origin', async () => {
    request({});
    await expect(siteOrigin()).resolves.toBeNull();

    request({ origin: 'null', host: 'bad host/path' });
    await expect(siteOrigin()).resolves.toBeNull();

    vi.stubEnv('SC_SITE_URL', 'javascript:alert(1)');
    await expect(siteOrigin()).resolves.toBeNull();
  });
});

describe('checkoutReturnUrl', () => {
  afterEach(() => vi.mocked(headers).mockReset());

  it('is the result page of this storefront in the shopper language', async () => {
    request({ origin: 'https://shop.example.com' });
    await expect(checkoutReturnUrl('ar')).resolves.toBe('https://shop.example.com/ar/checkout/final-receipt');
  });

  it('is null when the origin is unknown', async () => {
    request({});
    await expect(checkoutReturnUrl('en')).resolves.toBeNull();
  });
});
