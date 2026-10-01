import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createLoyaltyModule } from './mock/loyalty.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const request = (locale, pathname, method = 'GET', token = 'test-customer', query = '') => ({ method, pathname, locale, query: new URLSearchParams(query), token, body: null, headers: {} });

function setup(mode = { provider: 'elDokan' }) {
  const shopper = createShopperStore();
  const loyalty = createLoyaltyModule(shopper);
  loyalty.mode({ loyalty: mode });
  return { shopper, loyalty };
}

describe('mock loyalty module follows the contract', () => {
  it('is off by default (as on staging) and customer-only', () => {
    const shopper = createShopperStore();
    const loyalty = createLoyaltyModule(shopper);
    expect(loyalty.handle(request('en', '/loyalty'))[0]).toBe(404);
    expect(loyalty.decorate('layout', { features: {}, mobileNav: null }, 'en').features.loyalty).toBe(false);
    loyalty.mode({ loyalty: { provider: 'elDokan' } });
    expect(loyalty.handle(request('en', '/loyalty', 'GET', null))[0]).toBe(401);
    expect(loyalty.handle(request('en', '/cart'))).toBeNull();
  });

  it.each(['en', 'ar'])('El Dokan: summary, rewards, one reward, history, referral (%s)', (locale) => {
    const { loyalty } = setup();
    for (const [path, schema] of [
      ['/loyalty', 'LoyaltySummaryResponse'],
      ['/loyalty/rewards', 'LoyaltyRewardsResponse'],
      ['/loyalty/rewards/4', 'LoyaltyRewardResponse'],
      ['/loyalty/history', 'LoyaltyHistoryResponse'],
      ['/loyalty/referral', 'LoyaltyReferralResponse'],
    ]) {
      const [status, body] = loyalty.handle(request(locale, path));
      expect(status, path).toBe(200);
      expect(validate(schema, body), path).toEqual([]);
    }
    const rewards = loyalty.handle(request(locale, '/loyalty/rewards'))[1].data.items;
    expect(rewards.map((r) => r.canRedeem)).toEqual([true, true, false, false]);
  });

  it('redeems only what the rules allow, and the points go down', () => {
    const { loyalty } = setup();
    const [refused, why] = loyalty.handle(request('en', '/loyalty/rewards/6/redeem', 'POST'));
    expect([refused, why.error.code, why.error.message]).toEqual([409, 'cannot_redeem', 'You need 1,000 points more.']);
    expect(validate('ErrorResponse', why)).toEqual([]);

    const [created, body] = loyalty.handle(request('ar', '/loyalty/rewards/3/redeem', 'POST'));
    expect(created).toBe(201);
    expect(validate('LoyaltyRedeemResponse', body)).toEqual([]);
    expect([body.data.redemption.code, body.data.points.text]).toEqual(['GIFT-MOCK1', '500 نقطة']);

    loyalty.mode({ loyalty: { phone: 'unverified' } });
    const [blocked, reason] = loyalty.handle(request('en', '/loyalty/rewards/4/redeem', 'POST'));
    expect([blocked, reason.error.message]).toEqual([409, 'You need 300 points more.']);
    expect(loyalty.handle(request('en', '/loyalty/rewards'))[1].data.blocker.code).toBe('verify_phone');
  });

  it('iVend: summary only; referral off → 404', () => {
    const { loyalty } = setup({ provider: 'ivend' });
    const [status, body] = loyalty.handle(request('en', '/loyalty'));
    expect([status, validate('LoyaltySummaryResponse', body)]).toEqual([200, []]);
    expect(body.data.sections).toEqual({ rewards: false, history: false, referral: false });
    for (const path of ['/loyalty/rewards', '/loyalty/history', '/loyalty/referral', '/loyalty/rewards/3']) expect(loyalty.handle(request('en', path))[0], path).toBe(404);

    loyalty.mode({ loyalty: { provider: 'elDokan', referral: false } });
    expect(loyalty.handle(request('en', '/loyalty/referral'))[0]).toBe(404);
  });

  it('adds the layout switch and the bottom-nav points item before the language item', () => {
    const { loyalty } = setup();
    const layout = JSON.parse(fs.readFileSync('src/test/fixtures/v3/layout.en.json', 'utf8')).data;
    const decorated = loyalty.decorate('layout', layout, 'en');
    expect(validate('Layout', decorated)).toEqual([]);
    expect(decorated.features.loyalty).toBe(true);
    const ids = decorated.mobileNav.more.items.map((item) => item.id);
    expect(ids.indexOf('points')).toBe(ids.indexOf('language') - 1);
  });
});
