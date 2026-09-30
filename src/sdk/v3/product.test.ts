import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { createStorefrontClient } from './http';
import { getProduct, getProductRecommendations, getProductReviews, notifyWhenAvailable } from './product';

const ROOT = 'https://api.test/api/customer/v3/';

function setup(status = 200, body: unknown = { data: { value: 42 } }) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  const client = createStorefrontClient({ baseUrl: 'https://api.test', apiKey: 'k', fetch, revalidate: 60 });
  const lastCall = () => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url), init: init!, headers: init!.headers as Record<string, string> };
  };
  return { client, lastCall };
}

describe('product SDK', () => {
  it('reads a product by slug; an anonymous visitor may be served from the cache', async () => {
    const { client, lastCall } = setup();

    await expect(getProduct(client, { locale: 'en', token: null }, 'jj-baby-cologne-100ml')).resolves.toEqual({ value: 42 });

    const { url, init, headers } = lastCall();
    expect(url).toBe(`${ROOT}products/jj-baby-cologne-100ml`);
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Accept-Language']).toBe('en');
    expect((init as { next?: unknown }).next).toEqual({ revalidate: 60 });
  });

  it('sends the shopper token when there is one (their prices and limits), never cached', async () => {
    const { client, lastCall } = setup();

    await getProduct(client, { locale: 'ar', token: 'guest-1' }, 'x');

    const { init, headers } = lastCall();
    expect(headers).toMatchObject({ Authorization: 'Bearer guest-1', 'Accept-Language': 'ar' });
    expect(init.cache).toBe('no-store');
  });

  it('keeps an Arabic or unusual slug as one path segment', async () => {
    const { client, lastCall } = setup();

    await getProduct(client, { locale: 'ar', token: null }, 'جونسون-بيبي/كولونيا?x');

    expect(lastCall().url).toBe(`${ROOT}products/${encodeURIComponent('جونسون-بيبي/كولونيا?x')}`);
  });

  it('reads the recommendations of a product', async () => {
    const { client, lastCall } = setup();

    await getProductRecommendations(client, { locale: 'en', token: 'test-customer' }, 'jj-bath');

    const { url, headers } = lastCall();
    expect(url).toBe(`${ROOT}products/jj-bath/recommendations`);
    expect(headers.Authorization).toBe('Bearer test-customer');
  });

  it('reads a page of reviews without a token', async () => {
    const { client, lastCall } = setup();

    await getProductReviews(client, 'ar', 'jj-bath', { page: 2, perPage: 5 });

    const { url, headers } = lastCall();
    expect(url).toBe(`${ROOT}products/jj-bath/reviews?page=2&perPage=5`);
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Accept-Language']).toBe('ar');
  });

  it('asks to be told when a product is back, with an email only when one was typed', async () => {
    const { client, lastCall } = setup(200, { data: { subscribed: true } });

    await expect(notifyWhenAvailable(client, { locale: 'en', token: 'guest-1' }, 14400)).resolves.toEqual({ subscribed: true });
    let call = lastCall();
    expect(call.url).toBe(`${ROOT}products/14400/notify-me`);
    expect(call.init.method).toBe('POST');
    expect(call.headers.Authorization).toBe('Bearer guest-1');
    expect(JSON.parse(String(call.init.body))).toEqual({});

    await notifyWhenAvailable(client, { locale: 'en', token: 'guest-1' }, 14400, 'sara@example.com');
    call = lastCall();
    expect(JSON.parse(String(call.init.body))).toEqual({ email: 'sara@example.com' });

    await notifyWhenAvailable(client, { locale: 'en', token: 'guest-1' }, 14400, '');
    expect(JSON.parse(String(lastCall().init.body))).toEqual({});
  });

  describe('errors', () => {
    it('404 → not_found', async () => {
      const { client } = setup(404, { error: { code: 'not_found', message: 'Not found.' } });
      await expect(getProduct(client, { locale: 'en', token: null }, 'nope')).rejects.toMatchObject({ kind: 'not_found', code: 404 });
    });

    it('409 already_available → already_available with the backend message', async () => {
      const { client } = setup(409, { error: { code: 'already_available', message: 'This product is in stock now.' } });
      const error = await notifyWhenAvailable(client, { locale: 'en', token: 'guest-1' }, 8412).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'already_available', code: 409, message: 'This product is in stock now.' });
    });

    it('422 validation_failed → the email field message', async () => {
      const { client } = setup(422, { error: { code: 'validation_failed', message: 'Check the fields.', fields: { email: ['Enter your email.'] } } });
      await expect(notifyWhenAvailable(client, { locale: 'en', token: 'guest-1' }, 14400)).rejects.toMatchObject({
        kind: 'validation',
        fieldErrors: { email: ['Enter your email.'] },
      });
    });
  });
});
