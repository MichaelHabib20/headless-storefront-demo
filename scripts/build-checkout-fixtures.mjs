#!/usr/bin/env node
/**
 * Writes static fixtures for the checkout endpoints (used by component tests) from the mock
 * checkout module. After the backend is live, `npm run fixtures:record` should replace them
 * with real recorded responses.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createCheckoutModule, PAYMENT, PROMO } from './mock/checkout.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const out = path.resolve('src/test/fixtures/v3');
const write = (name, body) => {
  fs.writeFileSync(path.join(out, `${name}.json`), JSON.stringify(body, null, 1) + '\n');
  console.log(`wrote ${name}.json`);
};

for (const locale of ['en', 'ar']) {
  const store = createShopperStore();
  const checkout = createCheckoutModule(store);
  checkout.reset(); // the same order numbers in both languages
  const call = (method, pathname, body = null, token = 'test-customer', query = '') => {
    const request = { method, pathname, query: new URLSearchParams(query), token, locale, body, contentType: '', headers: { host: '127.0.0.1:4010' }, raw: '' };
    return (checkout.handle(request) ?? store.handle(request))[1];
  };

  // the seeded customer, first call: below the minimum order, no payment method yet
  write(`checkout-first.${locale}`, call('POST', '/checkout'));

  // above the minimum, pickup with installments (no plan yet) and a promo code
  call('PUT', '/cart/items/7346', { quantity: 2 });
  write(`pickup-branches.${locale}`, call('GET', '/pickup-branches'));
  write(`checkout-pickup.${locale}`, call('POST', '/checkout', { fulfilment: 'pickup', branchId: 71, paymentMethodId: PAYMENT.installments, promoCode: PROMO.percent }));

  // ready to place: delivery to the default address, cash on delivery
  write(`checkout.${locale}`, call('POST', '/checkout', { paymentMethodId: PAYMENT.cash }));

  // a guest with one product and nothing filled in yet
  const guest = call('POST', '/session/guest', null, null).data.token;
  call('PUT', '/cart/items/8658', { quantity: 2 }, guest);
  write(`checkout-guest.${locale}`, call('POST', '/checkout', null, guest));

  // results: online payment still pending, declined, and a placed order
  const online = call('POST', '/orders', { selections: { paymentMethodId: PAYMENT.cardOnline }, expectedTotal: 381, acceptTerms: true, returnUrl: 'http://127.0.0.1:3200/en/checkout/result' });
  write(`checkout-result-pending.${locale}`, call('GET', '/checkout/result', null, 'test-customer', `ref=${online.data.next.reference}`));
  call('GET', '/__pay/finish', null, null, `ref=${online.data.next.reference}&outcome=failed`);
  write(`checkout-result-failed.${locale}`, call('GET', '/checkout/result', null, 'test-customer', `ref=${online.data.next.reference}`));
  const placed = call('POST', '/orders', { selections: { paymentMethodId: PAYMENT.cash, note: 'Ring the bell twice' }, expectedTotal: 381, acceptTerms: true });
  write(`checkout-result.${locale}`, call('GET', '/checkout/result', null, 'test-customer', `ref=${placed.data.next.reference}`));
}
