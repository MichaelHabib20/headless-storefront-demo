import { describe, expect, it, vi } from 'vitest';
import { createStorefrontClient, type StorefrontClient } from './http';
import { getLoyalty, getLoyaltyHistory, getLoyaltyReferral, getLoyaltyReward, getLoyaltyRewards, redeemLoyaltyReward } from './loyalty';
import type { ShopperContext } from './shopper';

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

const customer: ShopperContext = { locale: 'en', token: 'cust-token' };
const customerAr: ShopperContext = { locale: 'ar', token: 'cust-token' };

const CASES: { name: string; call: (client: StorefrontClient) => Promise<unknown>; method: 'GET' | 'POST'; path: string; ctx: ShopperContext }[] = [
  { name: 'getLoyalty', call: (c) => getLoyalty(c, customer), method: 'GET', path: 'loyalty', ctx: customer },
  { name: 'getLoyaltyHistory', call: (c) => getLoyaltyHistory(c, customerAr), method: 'GET', path: 'loyalty/history?page=1&perPage=20', ctx: customerAr },
  { name: 'getLoyaltyHistory (paged)', call: (c) => getLoyaltyHistory(c, customer, 3, 10), method: 'GET', path: 'loyalty/history?page=3&perPage=10', ctx: customer },
  { name: 'getLoyaltyRewards', call: (c) => getLoyaltyRewards(c, customer), method: 'GET', path: 'loyalty/rewards', ctx: customer },
  { name: 'getLoyaltyReward', call: (c) => getLoyaltyReward(c, customerAr, '4'), method: 'GET', path: 'loyalty/rewards/4', ctx: customerAr },
  { name: 'getLoyaltyReward (encodes the id)', call: (c) => getLoyaltyReward(c, customer, 'a/b'), method: 'GET', path: 'loyalty/rewards/a%2Fb', ctx: customer },
  { name: 'redeemLoyaltyReward', call: (c) => redeemLoyaltyReward(c, customer, '3'), method: 'POST', path: 'loyalty/rewards/3/redeem', ctx: customer },
  { name: 'getLoyaltyReferral', call: (c) => getLoyaltyReferral(c, customer), method: 'GET', path: 'loyalty/referral', ctx: customer },
];

describe('loyalty SDK', () => {
  it.each(CASES)('$name → $method $path', async ({ call, method, path, ctx }) => {
    const { client, lastCall } = setup();

    await expect(call(client)).resolves.toEqual({ value: 42 });

    const { url, init, headers } = lastCall();
    expect(url).toBe(ROOT + path);
    expect(init.method).toBe(method);
    expect(headers).toMatchObject({ Authorization: `Bearer ${ctx.token}`, 'Accept-Language': ctx.locale, 'api-key': 'k' });
    // the redeem sends no body: the reward is in the path
    expect(init.body).toBeUndefined();
    expect(init.cache).toBe('no-store');
  });

  it('409 cannot_redeem → cannot_redeem with the backend reason', async () => {
    const { client } = setup(409, { error: { code: 'cannot_redeem', message: 'You need 1,000 points more.' } });
    await expect(redeemLoyaltyReward(client, customer, '6')).rejects.toMatchObject({ kind: 'cannot_redeem', code: 409, message: 'You need 1,000 points more.' });
  });

  it('404 while the store has no loyalty, 401 for a guest', async () => {
    await expect(getLoyalty(setup(404, { error: { code: 'not_found', message: 'Not found.' } }).client, customer)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(getLoyalty(setup(401, { error: { code: 'unauthenticated', message: 'Please sign in.' } }).client, customer)).rejects.toMatchObject({ kind: 'unauthenticated' });
  });
});
