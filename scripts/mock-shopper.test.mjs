import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

function client(locale = 'en') {
  const store = createShopperStore();
  let token = null;
  const call = (method, pathname, body = null, query = '') => {
    const [status, payload] = store.handle({ method, pathname, query: new URLSearchParams(query), token, locale, body });
    return { status, payload };
  };
  return {
    call,
    useToken(value) {
      token = value;
    },
  };
}

/** Every mock response must match the contract, so storefront work against the mock is safe. */
function expectValid(schema, payload) {
  expect(validate(schema, payload)).toEqual([]);
}

describe('mock shopper API follows the contract', () => {
  it.each(['en', 'ar'])('covers every endpoint (%s)', (locale) => {
    const api = client(locale);

    expectValid('MeResponse', api.call('GET', '/me').payload);
    const unauthenticated = api.call('GET', '/cart');
    expect(unauthenticated.status).toBe(401);
    expectValid('ErrorResponse', unauthenticated.payload);
    expect(unauthenticated.payload.error.code).toBe('unauthenticated');

    const session = api.call('POST', '/session/guest');
    expect(session.status).toBe(201);
    expectValid('GuestSessionResponse', session.payload);
    api.useToken(session.payload.data.token);

    const cart = api.call('GET', '/cart');
    expectValid('CartResponse', cart.payload);
    expect(cart.payload.data.checkout.blockers[0].code).toBe('empty_cart');

    const me = api.call('GET', '/me').payload;
    expectValid('MeResponse', me);
    expect(me.data.isGuest).toBe(true);

    const productId = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data.sections.find((s) => s.products.length).products[0].id;

    expectValid('CartResponse', api.call('PUT', `/cart/items/${productId}`, { quantity: 2 }).payload);
    expect(api.call('PUT', `/cart/items/${productId}`, { quantity: -1 }).status).toBe(422);
    expectValid('CartResponse', api.call('DELETE', `/cart/items/${productId}`).payload);
    expectValid('CartResponse', api.call('DELETE', '/cart').payload);

    expectValid('ListStateResponse', api.call('PUT', `/wishlist/items/${productId}`).payload);
    expectValid('WishlistResponse', api.call('GET', '/wishlist', null, 'page=1&perPage=5').payload);
    const moved = api.call('POST', `/wishlist/items/${productId}/move-to-cart`).payload;
    expect(moved.data.wishlist.count).toBe(0);
    expect(moved.data.cart.items).toHaveLength(1);
    expectValid('ListStateResponse', api.call('DELETE', `/wishlist/items/${productId}`).payload);

    expectValid('ListStateResponse', api.call('PUT', `/compare/items/${productId}`).payload);
    expectValid('CompareResponse', api.call('GET', '/compare').payload);
    expectValid('ListStateResponse', api.call('DELETE', `/compare/items/${productId}`).payload);

    const notifications = api.call('GET', '/notifications', null, 'perPage=5').payload;
    expectValid('NotificationsResponse', notifications);
    const unreadBefore = notifications.data.unreadCount;
    expectValid('UnreadCountResponse', api.call('POST', `/notifications/${notifications.data.items[0].id}/read`).payload);
    expect(api.call('GET', '/notifications').payload.data.unreadCount).toBe(unreadBefore - 1);
    expectValid('UnreadCountResponse', api.call('POST', '/notifications/read-all').payload);

    expect(api.call('PUT', '/cart/items/999999999', { quantity: 1 }).status).toBe(404);
  });

  it('reading notifications never marks them read, and reads are per shopper', () => {
    const a = client();
    const b = client();
    a.useToken(a.call('POST', '/session/guest').payload.data.token);
    b.useToken(b.call('POST', '/session/guest').payload.data.token);
    const before = b.call('GET', '/notifications').payload.data.unreadCount;
    a.call('GET', '/notifications');
    a.call('POST', '/notifications/read-all');
    expect(b.call('GET', '/notifications').payload.data.unreadCount).toBe(before);
  });

  it('enforces the compare maximum with 409 compare_full', () => {
    const api = client();
    api.useToken(api.call('POST', '/session/guest').payload.data.token);
    const ids = JSON.parse(fs.readFileSync('src/test/fixtures/v3/home.en.json', 'utf8')).data.sections.flatMap((s) => s.products.map((p) => p.id));
    for (const id of ids.slice(0, 4)) expect(api.call('PUT', `/compare/items/${id}`).status).toBe(200);
    const full = api.call('PUT', `/compare/items/${ids[4]}`);
    expect(full.status).toBe(409);
    expect(full.payload.error.code).toBe('compare_full');
  });
});
