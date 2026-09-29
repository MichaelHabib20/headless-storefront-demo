import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import { createStorefrontClient, type StorefrontClient } from './http';
import {
  addToCompare,
  addToWishlist,
  clearCart,
  createGuestSession,
  getCart,
  getCompare,
  getMe,
  getNotifications,
  getWishlist,
  markAllNotificationsRead,
  markNotificationRead,
  moveWishlistItemToCart,
  removeCartItem,
  removeFromCompare,
  removeFromWishlist,
  setCartItem,
  type ShopperContext,
} from './shopper';

const ROOT = 'https://api.test/api/customer/v3/';

function mockFetch(status: number, body: unknown) {
  return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

function setup(status = 200, body: unknown = { data: { ok: true } }) {
  const fetch = mockFetch(status, body);
  const client = createStorefrontClient({ baseUrl: 'https://api.test', apiKey: 'k', fetch, revalidate: 60 });
  const lastCall = () => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url), init: init!, headers: init!.headers as Record<string, string> };
  };
  return { fetch, client, lastCall };
}

const customer: ShopperContext = { locale: 'en', token: 'cust-token' };
const guestAr: ShopperContext = { locale: 'ar', token: 'guest-1' };

interface Case {
  name: string;
  call: (client: StorefrontClient) => Promise<unknown>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  ctx: ShopperContext;
}

const CASES: Case[] = [
  { name: 'getMe', call: (c) => getMe(c, customer), method: 'GET', path: 'me', ctx: customer },
  { name: 'getCart', call: (c) => getCart(c, customer), method: 'GET', path: 'cart', ctx: customer },
  { name: 'clearCart', call: (c) => clearCart(c, guestAr), method: 'DELETE', path: 'cart', ctx: guestAr },
  { name: 'setCartItem', call: (c) => setCartItem(c, customer, 7346, 3), method: 'PUT', path: 'cart/items/7346', body: { quantity: 3 }, ctx: customer },
  { name: 'setCartItem (0 removes)', call: (c) => setCartItem(c, guestAr, 7346, 0), method: 'PUT', path: 'cart/items/7346', body: { quantity: 0 }, ctx: guestAr },
  { name: 'removeCartItem', call: (c) => removeCartItem(c, customer, 36480), method: 'DELETE', path: 'cart/items/36480', ctx: customer },
  { name: 'getWishlist', call: (c) => getWishlist(c, customer), method: 'GET', path: 'wishlist', ctx: customer },
  { name: 'getWishlist (paged)', call: (c) => getWishlist(c, guestAr, { page: 2, perPage: 10 }), method: 'GET', path: 'wishlist?page=2&perPage=10', ctx: guestAr },
  { name: 'addToWishlist', call: (c) => addToWishlist(c, customer, 8412), method: 'PUT', path: 'wishlist/items/8412', ctx: customer },
  { name: 'removeFromWishlist', call: (c) => removeFromWishlist(c, customer, 8412), method: 'DELETE', path: 'wishlist/items/8412', ctx: customer },
  { name: 'moveWishlistItemToCart', call: (c) => moveWishlistItemToCart(c, guestAr, 8658), method: 'POST', path: 'wishlist/items/8658/move-to-cart', ctx: guestAr },
  { name: 'getCompare', call: (c) => getCompare(c, customer), method: 'GET', path: 'compare', ctx: customer },
  { name: 'addToCompare', call: (c) => addToCompare(c, customer, 33594), method: 'PUT', path: 'compare/items/33594', ctx: customer },
  { name: 'removeFromCompare', call: (c) => removeFromCompare(c, guestAr, 33594), method: 'DELETE', path: 'compare/items/33594', ctx: guestAr },
  { name: 'getNotifications', call: (c) => getNotifications(c, customer), method: 'GET', path: 'notifications', ctx: customer },
  { name: 'getNotifications (paged)', call: (c) => getNotifications(c, customer, { page: 3 }), method: 'GET', path: 'notifications?page=3', ctx: customer },
  { name: 'markNotificationRead', call: (c) => markNotificationRead(c, customer, 901), method: 'POST', path: 'notifications/901/read', ctx: customer },
  { name: 'markAllNotificationsRead', call: (c) => markAllNotificationsRead(c, guestAr), method: 'POST', path: 'notifications/read-all', ctx: guestAr },
];

describe('shopper SDK', () => {
  it.each(CASES)('$name → $method $path', async ({ call, method, path, body, ctx }) => {
    const { client, lastCall } = setup(200, { data: { value: 42 } });

    await expect(call(client)).resolves.toEqual({ value: 42 });

    const { url, init, headers } = lastCall();
    expect(url).toBe(ROOT + path);
    expect(init.method).toBe(method);
    expect(headers).toMatchObject({ Authorization: `Bearer ${ctx.token}`, 'Accept-Language': ctx.locale, 'api-key': 'k' });
    if (body === undefined) {
      expect(init.body).toBeUndefined();
      expect(headers['Content-Type']).toBeUndefined();
    } else {
      expect(JSON.parse(String(init.body))).toEqual(body);
      expect(headers['Content-Type']).toBe('application/json');
    }
    // Personal data is never shared through the framework cache.
    expect(init.cache).toBe('no-store');
    expect((init as { next?: unknown }).next).toBeUndefined();
  });

  it('starts a guest session without a token', async () => {
    const { client, lastCall } = setup(201, { data: { token: 'guest-9', isGuest: true } });

    await expect(createGuestSession(client, 'ar')).resolves.toEqual({ token: 'guest-9', isGuest: true });

    const { url, init, headers } = lastCall();
    expect(url).toBe(`${ROOT}session/guest`);
    expect(init.method).toBe('POST');
    expect(headers.Authorization).toBeUndefined();
    expect(headers['Accept-Language']).toBe('ar');
    expect(init.cache).toBe('no-store');
  });

  it('asks who is shopping without a token (anonymous visitors)', async () => {
    const { client, lastCall } = setup(200, { data: { authenticated: false } });

    await expect(getMe(client, { locale: 'en', token: null })).resolves.toEqual({ authenticated: false });

    const { url, init, headers } = lastCall();
    expect(url).toBe(`${ROOT}me`);
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBeUndefined();
  });

  describe('errors', () => {
    it('401 → unauthenticated', async () => {
      const { client } = setup(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } });
      const error = await getCart(client, { locale: 'en', token: null }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'unauthenticated', code: 401, message: 'Please start a session first.' });
    });

    it('409 compare_full → compare_full with the backend message', async () => {
      const { client } = setup(409, { error: { code: 'compare_full', message: 'You can compare up to 4 products.' } });
      await expect(addToCompare(client, customer, 9822)).rejects.toMatchObject({
        kind: 'compare_full',
        code: 409,
        message: 'You can compare up to 4 products.',
      });
    });

    it('422 validation_failed → validation with per-field messages', async () => {
      const { client } = setup(422, {
        error: { code: 'validation_failed', message: 'Invalid data.', fields: { quantity: ['This quantity is not allowed.'] } },
      });
      const error = (await setCartItem(client, customer, 7346, 999).catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe('validation');
      expect(error.code).toBe(422);
      expect(error.fieldErrors).toEqual({ quantity: ['This quantity is not allowed.'] });
    });

    it('422 quantity_not_allowed → quantity_not_allowed', async () => {
      const { client } = setup(422, { error: { code: 'quantity_not_allowed', message: 'Not allowed.' } });
      await expect(setCartItem(client, customer, 7346, 7)).rejects.toMatchObject({ kind: 'quantity_not_allowed', fieldErrors: {} });
    });

    it('404 not_found on unknown products', async () => {
      const { client } = setup(404, { error: { code: 'not_found', message: 'Not found.' } });
      await expect(addToWishlist(client, customer, 1)).rejects.toMatchObject({ kind: 'not_found', code: 404 });
    });

    it('unknown codes fall back to the HTTP status', async () => {
      const { client } = setup(409, { error: { code: 'something_new', message: 'Busy.' } });
      await expect(removeFromCompare(client, customer, 1)).rejects.toMatchObject({ kind: 'conflict', message: 'Busy.' });
    });

    it('rate limiting and server errors', async () => {
      const limited = setup(429, { error: { code: 'rate_limited', message: 'Slow down.' } });
      await expect(markAllNotificationsRead(limited.client, customer)).rejects.toMatchObject({ kind: 'rate_limited' });

      const down = setup(500, { error: { code: 'server_error', message: 'Down.' } });
      await expect(getNotifications(down.client, customer)).rejects.toMatchObject({ kind: 'server', message: 'Down.' });
    });
  });
});
