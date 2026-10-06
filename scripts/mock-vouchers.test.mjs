import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCheckoutModule, PROMO } from './mock/checkout.mjs';
import { createShopperStore } from './mock/shopper.mjs';
import { createVouchersModule } from './mock/vouchers.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

function api(locale = 'en', on = true) {
  const store = createShopperStore();
  const checkout = createCheckoutModule(store);
  checkout.reset();
  const vouchers = createVouchersModule(store);
  vouchers.reset();
  vouchers.mode({ vouchers: { on } });
  let token = 'test-customer';
  const call = (method, pathname, body = null) => {
    const request = { method, pathname, query: new URLSearchParams(), token, locale, body, contentType: '', headers: {}, raw: '' };
    const [status, payload] = vouchers.handle(request) ?? checkout.handle(request) ?? store.handle(request);
    return { status, payload };
  };
  return {
    call,
    vouchers,
    as(value) {
      token = value;
    },
  };
}

describe('mock vouchers follow the contract', () => {
  it('is off by default (as on staging) and customer-only', () => {
    const mock = api('en', false);
    expect(mock.call('GET', '/vouchers').status).toBe(404);
    expect(mock.vouchers.decorate('layout', { features: {} }).features.vouchers).toBe(false);
    expect(mock.call('POST', '/checkout', {}).payload.data.promo.suggestions).toBeUndefined();

    mock.vouchers.mode({ vouchers: { on: true } });
    mock.as(null);
    expect(mock.call('GET', '/vouchers').status).toBe(401);
  });

  it.each(['en', 'ar'])('the list: one status each, active first (%s)', (locale) => {
    const { status, payload } = api(locale).call('GET', '/vouchers');
    expect(status).toBe(200);
    expect(validate('VouchersResponse', payload)).toEqual([]);
    expect(payload.data.items.map((v) => [v.code, v.status])).toEqual([['FREEDEL', 'active'], ['SAVE10', 'active'], ['ONCE', 'used'], ['OLD', 'expired']]);
    expect(payload.data.statuses.map((s) => s.count)).toEqual([2, 1, 1]);
  });

  it('adding a code: added, refused with the reason in fields.code', () => {
    const mock = api();
    const added = mock.call('POST', '/vouchers', { code: ' welcome20 ' });
    expect(added.status).toBe(201);
    expect(validate('VoucherAddedResponse', added.payload)).toEqual([]);
    expect(added.payload.data.vouchers.items.map((v) => v.code)).toContain('WELCOME20');

    for (const [code, message] of [['WELCOME20', 'You have already added this voucher.'], ['NOPE', 'This voucher code is not valid.'], ['', 'Enter a voucher code.']]) {
      const refused = mock.call('POST', '/vouchers', { code });
      expect([refused.status, refused.payload.error.code, refused.payload.error.fields.code[0]]).toEqual([422, 'validation_failed', message]);
      expect(validate('ErrorResponse', refused.payload)).toEqual([]);
    }
  });

  it('checkout suggests the active codes, not the one applied, and never to guests', () => {
    const mock = api();
    const first = mock.call('POST', '/checkout', { fulfilment: 'delivery' }).payload;
    expect(validate('CheckoutResponse', first)).toEqual([]);
    expect(first.data.promo.suggestions).toEqual([{ code: 'FREEDEL', benefit: 'Free delivery' }, { code: 'SAVE10', benefit: '10% off' }]);

    const applied = mock.call('POST', '/checkout', { fulfilment: 'delivery', promoCode: PROMO.percent }).payload.data.promo;
    expect([applied.applied, applied.suggestions.map((s) => s.code)]).toEqual([true, ['FREEDEL']]);

    mock.as(mock.call('POST', '/session/guest').payload.data.token);
    expect(mock.call('POST', '/checkout', {}).payload.data.promo.suggestions).toBeUndefined();
  });
});
