import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCheckoutModule, PAYMENT } from './mock/checkout.mjs';
import { createShopperStore } from './mock/shopper.mjs';
import { createWalletModule } from './mock/wallet.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const RETURN_URL = 'http://127.0.0.1:3200/en/checkout/result';

/** The wallet and checkout modules on one shopper store. */
function api(locale = 'en', wallet = { on: true }) {
  const store = createShopperStore();
  const checkout = createCheckoutModule(store);
  checkout.reset();
  const walletModule = createWalletModule(store);
  walletModule.reset();
  walletModule.mode({ wallet });
  let token = 'test-customer';
  const call = (method, pathname, body = null, query = '') => {
    const request = { method, pathname, query: new URLSearchParams(query), token, locale, body, contentType: '', headers: { host: '127.0.0.1:4010' }, raw: '' };
    const [status, payload] = walletModule.handle(request) ?? checkout.handle(request) ?? store.handle(request);
    return { status, payload };
  };
  return {
    call,
    walletModule,
    as(value) {
      token = value;
    },
    compute(selections) {
      const { status, payload } = call('POST', '/checkout', selections);
      expect(status).toBe(200);
      expect(validate('CheckoutResponse', payload)).toEqual([]);
      return payload.data;
    },
    wallet(query = '') {
      const { status, payload } = call('GET', '/wallet', null, query);
      expect(status).toBe(200);
      expect(validate('WalletResponse', payload)).toEqual([]);
      return payload.data;
    },
    /** 356 EGP of items; delivery to the default address adds 25. */
    fillCart() {
      call('PUT', '/cart/items/7346', { quantity: 2 });
    },
  };
}

describe('mock wallet follows the contract', () => {
  it('is off by default (as on staging) and customer-only', () => {
    const mock = api('en', { on: false });
    expect(mock.call('GET', '/wallet').status).toBe(404);
    expect(mock.walletModule.decorate('layout', { features: {}, mobileNav: null }, 'en').features.wallet).toBe(false);
    expect(mock.compute({}).wallet).toBeNull();

    mock.walletModule.mode({ wallet: { on: true } });
    mock.as(null);
    expect(mock.call('GET', '/wallet').status).toBe(401);
    mock.as(mock.call('POST', '/session/guest').payload.data.token);
    const guest = mock.call('GET', '/wallet');
    expect([guest.status, guest.payload.error.code]).toEqual([401, 'unauthenticated']);
  });

  it.each(['en', 'ar'])('balance and history (%s)', (locale) => {
    const wallet = api(locale).wallet();
    expect(wallet.balance.amount).toBe(150);
    expect(wallet.items.map((entry) => [entry.kind, entry.credit, entry.amount.amount])).toEqual([['payment', false, -50], ['deposit', true, 200]]);
    expect(wallet.items[0].orderId).toBe('mock-order-48200');
    expect(wallet.items[0].amount.display.startsWith('-')).toBe(true);
  });

  it('pays part of the order: the rest needs a method', () => {
    const mock = api();
    mock.fillCart();

    const offered = mock.compute({ fulfilment: 'delivery', paymentMethodId: PAYMENT.cash });
    expect([offered.wallet.selected, offered.totals.total.amount]).toEqual([false, 381]);

    const part = mock.compute({ fulfilment: 'delivery', paymentMethodId: PAYMENT.cash, useWallet: true });
    expect([part.wallet.selected, part.wallet.amount.amount, part.wallet.coversTotal]).toEqual([true, 150, false]);
    expect(part.totals.lines.at(-1)).toMatchObject({ kind: 'wallet', amount: { amount: -150 } });
    expect(part.totals.total.amount).toBe(231);
    expect(part.payment.methods.length).toBeGreaterThan(0);

    const noMethod = mock.compute({ fulfilment: 'delivery', useWallet: true });
    expect(noMethod.missing.map((item) => item.code)).toEqual(['payment_method']);
  });

  it('pays everything: no method, the order is placed, the balance goes down', () => {
    const mock = api('en', { on: true, balance: 500 });
    mock.fillCart();

    const all = mock.compute({ fulfilment: 'delivery', useWallet: true });
    expect([all.wallet.coversTotal, all.totals.total.amount, all.payment.methods, all.payment.selected, all.canPlaceOrder]).toEqual([true, 0, [], null, true]);

    const selections = { fulfilment: 'delivery', addressId: all.fulfilment.addressId, useWallet: true };
    const placed = mock.call('POST', '/orders', { selections, expectedTotal: 0, acceptTerms: true, returnUrl: RETURN_URL });
    expect(placed.status).toBe(200);
    expect(validate('PlaceOrderResponse', placed.payload)).toEqual([]);
    expect(placed.payload.data.next.type).toBe('done');

    const wallet = mock.wallet();
    expect(wallet.balance.amount).toBe(119);
    expect(wallet.items[0]).toMatchObject({ kind: 'payment', credit: false, amount: { amount: -381 } });
  });

  it('a wallet asked for without a balance is dropped with a message', () => {
    const mock = api('en', { on: true, balance: 0 });
    const checkout = mock.compute({ fulfilment: 'delivery', useWallet: true });
    expect(checkout.wallet).toBeNull();
    expect(checkout.messages.map((message) => message.level)).toEqual(['warning']);
  });

  it('adds the layout switch and the bottom-nav wallet item', () => {
    const mock = api();
    const layout = JSON.parse(fs.readFileSync('src/test/fixtures/v3/layout.en.json', 'utf8')).data;
    const decorated = mock.walletModule.decorate('layout', layout, 'en');
    expect(validate('Layout', decorated)).toEqual([]);
    expect(decorated.features.wallet).toBe(true);
    expect(decorated.mobileNav.more.items.some((item) => item.id === 'wallet')).toBe(true);
  });
});
