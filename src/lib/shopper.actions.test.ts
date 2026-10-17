import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { addToCartAction, toggleCompareAction, toggleWishlistAction } from './shopper.actions';
import { ensureShopperContext, forgetGuest } from './shopper.server';
import { trackServerEvent } from './marketing.server';

/** Cookie jar + backend stand-ins: the session helpers and the SDK's fetch. */
const env = vi.hoisted(() => ({
  customer: null as string | null,
  guest: null as string | null,
  guests: 0,
  /** Whether the SDK's onTokenRefused may drop the customer cookie (false: rendering, read-only cookies). */
  canDrop: true,
  fetch: undefined as unknown as Mock<typeof fetch>,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn((task: () => unknown) => task()) }));
vi.mock('./marketing.server', () => ({ trackServerEvent: vi.fn() }));

vi.mock('./shopper.server', () => ({
  ensureShopperContext: vi.fn(async (locale: 'en' | 'ar') => {
    if (!env.customer && !env.guest) env.guest = `guest-${++env.guests}`;
    return { locale, token: env.customer ?? env.guest };
  }),
  shopperToken: vi.fn(async () => env.customer ?? env.guest),
  guestToken: vi.fn(async () => env.guest),
  forgetGuest: vi.fn(async () => {
    env.guest = null;
  }),
}));

vi.mock('./storefront.server', async () => {
  const { createStorefrontClient } = await import('@/sdk');
  return {
    storefrontClient: () =>
      createStorefrontClient({
        baseUrl: 'https://api.test',
        fetch: (input, init) => env.fetch(input, init),
        // like storefront.server.ts forgetRefusedToken: the refused customer cookie goes
        onTokenRefused: (token) => {
          if (env.canDrop && token === env.customer) env.customer = null;
        },
      }),
  };
});

const listState = { data: { count: 1, productIds: [8412], maxItems: 4 } };

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function calls() {
  return env.fetch.mock.calls.map(([url, init]) => ({
    url: String(url).replace('https://api.test/api/customer/v3/', ''),
    method: (init as RequestInit).method,
    auth: ((init as RequestInit).headers as Record<string, string>).Authorization,
    body: (init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : undefined,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  env.customer = null;
  env.guest = null;
  env.guests = 0;
  env.canDrop = true;
  env.fetch = vi.fn<typeof fetch>(async () => reply(200, listState));
});

describe('shopper server actions', () => {
  it('starts a guest session on the first action, sets the quantity and answers with GET /me read after it (no page re-render)', async () => {
    const me = { authenticated: true, isGuest: true, counts: { cart: 1, wishlist: 0, compare: 0, unreadNotifications: 0 }, cartQuantities: { '7346': 1 } };
    env.fetch = vi.fn<typeof fetch>(async (input) => reply(200, { data: String(input).endsWith('/me') ? me : {} }));

    await expect(addToCartAction('en', 7346, 1)).resolves.toEqual({
      ok: true,
      message: 'Added to cart.',
      me: expect.objectContaining({ counts: me.counts }),
      // Setting the guest cookie made Next re-render the page in this answer: no refresh needed after it.
      rendered: true,
    });

    expect(ensureShopperContext).toHaveBeenCalledWith('en');
    expect(calls()).toEqual([
      { url: 'cart/items/7346', method: 'PUT', auth: 'Bearer guest-1', body: { quantity: 1 } },
      { url: 'me', method: 'GET', auth: 'Bearer guest-1', body: undefined },
    ]);
    // The shell shows these counts and refreshes the page in the background (ShopperStateProvider).
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('still reports the add when GET /me fails after it, and does not write again', async () => {
    env.fetch = vi.fn<typeof fetch>(async (input) => (String(input).endsWith('/me') ? reply(500, { error: { code: 'server_error', message: 'x' } }) : reply(200, { data: {} })));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    env.guest = 'guest-known';

    // A shopper with a session: no cookie set, so no `rendered` (the shell refreshes the page in the background).
    await expect(addToCartAction('en', 7346, 2)).resolves.toEqual({ ok: true, message: 'Added to cart.', me: null });
    expect(calls().map(({ method, url }) => `${method} ${url}`)).toEqual(['PUT cart/items/7346', 'GET me']);
  });

  it('uses the signed-in customer token when there is one', async () => {
    env.customer = 'test-customer';
    await toggleWishlistAction('en', 8412, true);
    expect(calls()).toEqual([{ url: 'wishlist/items/8412', method: 'PUT', auth: 'Bearer test-customer', body: undefined }]);
  });

  it('adds and removes wishlist and compare items, with localized messages', async () => {
    await expect(toggleWishlistAction('ar', 8412, false)).resolves.toEqual({ ok: true, message: 'تمت الإزالة من المفضلة.' });
    await expect(toggleCompareAction('en', 8412, true)).resolves.toEqual({ ok: true, message: 'Added to compare.' });
    await expect(toggleCompareAction('en', 8412, false)).resolves.toEqual({ ok: true, message: 'Removed from compare.' });
    expect(calls().map(({ method, url }) => `${method} ${url}`)).toEqual([
      'DELETE wishlist/items/8412',
      'PUT compare/items/8412',
      'DELETE compare/items/8412',
    ]);
  });

  it('returns the backend message when the compare list is full, without revalidating', async () => {
    env.fetch = vi.fn<typeof fetch>(async () => reply(409, { error: { code: 'compare_full', message: 'You can compare up to 4 products.' } }));

    await expect(toggleCompareAction('en', 9822, true)).resolves.toEqual({ ok: false, message: 'You can compare up to 4 products.' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('starts a fresh guest session once when the backend forgot the guest', async () => {
    env.guest = 'guest-expired';
    env.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } }))
      .mockResolvedValueOnce(reply(200, listState));

    await expect(toggleWishlistAction('en', 8412, true)).resolves.toMatchObject({ ok: true });
    expect(forgetGuest).toHaveBeenCalledOnce();
    expect(calls().map((c) => c.auth)).toEqual(['Bearer guest-expired', 'Bearer guest-1']);
  });

  it('a customer token the backend refused (signed out elsewhere, expired): the cookie goes and the write is done as a guest', async () => {
    env.customer = 'revoked-customer';
    env.fetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(reply(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } }))
      .mockResolvedValueOnce(reply(200, listState));

    await expect(toggleWishlistAction('en', 8412, true)).resolves.toMatchObject({ ok: true });
    expect(env.customer).toBeNull();
    expect(forgetGuest).not.toHaveBeenCalled();
    expect(calls().map((c) => c.auth)).toEqual(['Bearer revoked-customer', 'Bearer guest-1']);
  });

  it('does not retry a customer token that is still there (nothing was dropped)', async () => {
    env.customer = 'stale-customer';
    env.canDrop = false;
    env.fetch = vi.fn<typeof fetch>(async () => reply(401, { error: { code: 'unauthenticated', message: 'Please sign in again.' } }));

    await expect(addToCartAction('en', 7346, 1)).resolves.toEqual({ ok: false, message: 'Please sign in again.' });
    expect(forgetGuest).not.toHaveBeenCalled();
    expect(env.fetch).toHaveBeenCalledOnce();
  });

  it('shows its own translated message when the store cannot be reached', async () => {
    env.fetch = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(addToCartAction('ar', 7346, 1)).resolves.toEqual({ ok: false, message: 'حدث خطأ ما. حاول مرة أخرى.' });
  });

  it('sends the server-side marketing event after a successful add to cart / wishlist only', async () => {
    env.fetch = vi.fn<typeof fetch>(async () => reply(200, { data: {} }));
    await addToCartAction('ar', 7346, 2);
    await toggleWishlistAction('en', 8412, true);
    await toggleWishlistAction('en', 8412, false);
    expect(vi.mocked(trackServerEvent).mock.calls).toEqual([
      ['ar', { name: 'add_to_cart', productIds: [7346] }],
      ['en', { name: 'add_to_wishlist', productIds: [8412] }],
    ]);

    vi.mocked(trackServerEvent).mockClear();
    env.fetch = vi.fn<typeof fetch>(async () => reply(422, { error: { code: 'quantity_not_allowed', message: 'This quantity is not allowed.' } }));
    await addToCartAction('en', 7346, 99);
    expect(trackServerEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed input without calling the backend', async () => {
    await expect(addToCartAction('en', -1, 1)).resolves.toMatchObject({ ok: false });
    await expect(addToCartAction('en', 7346, 0)).resolves.toMatchObject({ ok: false });
    await expect(toggleWishlistAction('en', 1.5, true)).resolves.toMatchObject({ ok: false });
    await expect(toggleCompareAction('en', 8412, 'yes' as unknown as boolean)).resolves.toMatchObject({ ok: false });
    await expect(toggleCompareAction('xx' as 'en', 8412, true)).resolves.toMatchObject({ ok: true, message: 'Added to compare.' });
    expect(env.fetch).toHaveBeenCalledOnce();
    expect(ensureShopperContext).toHaveBeenCalledOnce();
  });
});
