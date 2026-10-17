import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { checkShopper } from './session';

const env = vi.hoisted(() => ({ fetch: undefined as unknown as Mock<typeof fetch> }));

vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock('./shopper.server', () => ({ forgetGuest: vi.fn() }));
vi.mock('./storefront.server', async () => {
  const { createStorefrontClient } = await import('@/sdk');
  return { storefrontClient: () => createStorefrontClient({ baseUrl: 'https://api.test', fetch: (input, init) => env.fetch(input, init) }) };
});

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const customerMe = { authenticated: true, isGuest: false, customer: { id: 1 }, counts: { cart: 1, wishlist: 0, compare: 0, unreadNotifications: 0 }, cartQuantities: {}, wishlistProductIds: [], compareProductIds: [] };
const anonymous = { ...customerMe, authenticated: false, customer: null };

beforeEach(() => {
  env.fetch = vi.fn<typeof fetch>(async () => reply(200, { data: customerMe }));
});

describe('checkShopper: what GET /me says about the customer cookie', () => {
  it('live: the backend knows the customer', async () => {
    await expect(checkShopper('en', 'good.token', null)).resolves.toEqual({ me: customerMe, session: 'live' });
    expect((env.fetch.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer good.token' });
  });

  it('dead: revoked by a sign-out elsewhere (401 on every path)', async () => {
    env.fetch.mockResolvedValue(reply(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } }));
    await expect(checkShopper('en', 'revoked.token', 'guest.token')).resolves.toEqual({ me: null, session: 'dead' });
  });

  it('dead: expired or unknown (GET /me answers anonymous)', async () => {
    env.fetch.mockResolvedValue(reply(200, { data: anonymous }));
    await expect(checkShopper('ar', 'expired.token', null)).resolves.toEqual({ me: null, session: 'dead' });
  });

  it('dead without asking: a cookie that is no token', async () => {
    await expect(checkShopper('en', 'not a token', null)).resolves.toEqual({ me: null, session: 'dead' });
    expect(env.fetch).not.toHaveBeenCalled();
  });

  it('unknown: the backend is down or unreachable, nobody is signed out', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    env.fetch.mockResolvedValue(reply(500, { error: { code: 'server_error', message: 'x' } }));
    await expect(checkShopper('en', 'good.token', null)).resolves.toEqual({ me: null, session: 'unknown' });
    env.fetch.mockRejectedValue(new TypeError('fetch failed'));
    await expect(checkShopper('en', 'good.token', null)).resolves.toEqual({ me: null, session: 'unknown' });
    log.mockRestore();
  });

  it('none: a guest (or nobody) has no customer session to lose', async () => {
    env.fetch.mockResolvedValue(reply(200, { data: { ...anonymous, authenticated: true, isGuest: true } }));
    await expect(checkShopper('en', null, 'guest.token')).resolves.toMatchObject({ session: 'none' });
    env.fetch.mockResolvedValue(reply(401, { error: { code: 'unauthenticated', message: 'x' } }));
    await expect(checkShopper('en', null, 'old.guest')).resolves.toEqual({ me: null, session: 'none' });
  });
});
