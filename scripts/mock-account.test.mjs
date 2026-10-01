import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { orderRows } from './mock/account-state.mjs';
import { createAccountModule } from './mock/account.mjs';
import { createModules } from './mock/modules.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

/** The account module on its own shopper store; `call` answers like the mock API does. */
function api(locale = 'en', token = 'test-customer') {
  const store = createShopperStore();
  const account = createAccountModule(store);
  account.reset();
  let current = token;
  const call = (method, pathname, body = null, query = '') => {
    const answer = account.handle({ method, pathname, query: new URLSearchParams(query), token: current, locale, body });
    if (!answer) throw new Error(`not handled: ${method} ${pathname}`);
    return { status: answer[0], payload: answer[1] };
  };
  const guest = () => {
    current = store.handle({ method: 'POST', pathname: '/session/guest', query: new URLSearchParams(), token: null, locale, body: null })[1].data.token;
    return current;
  };
  return { call, store, guest, session: () => store.session(current) };
}

function expectValid(schema, payload) {
  expect(validate(schema, payload)).toEqual([]);
}

const newAddress = (overrides = {}) => ({
  cityId: 2,
  areaId: 22,
  districtId: null,
  values: { label: 'Work', street: 'Desert Rd', building: '4', floor: null, apartment: '', phone: '01000000002' },
  ...overrides,
});

describe('mock account module follows the contract', () => {
  it.each(['en', 'ar'])('address book answers (%s)', (locale) => {
    const { call } = api(locale);

    const book = call('GET', '/addresses');
    expectValid('AddressesResponse', book.payload);
    expect(book.payload.data.items).toHaveLength(1);

    const created = call('POST', '/addresses', newAddress());
    expect(created.status).toBe(201);
    expectValid('AddressSavedResponse', created.payload);
    expect(created.payload.data.address.deliverable).toBe(false);
    expect(created.payload.data.items).toHaveLength(2);

    const id = created.payload.data.address.id;
    const updated = call('PUT', `/addresses/${id}`, newAddress({ areaId: 21, isDefault: true }));
    expectValid('AddressSavedResponse', updated.payload);

    expectValid('AddressesResponse', call('POST', `/addresses/${updated.payload.data.address.id}/default`).payload);
    expectValid('AddressesResponse', call('DELETE', `/addresses/${updated.payload.data.address.id}`).payload);

    const invalid = call('POST', '/addresses', { cityId: 2, values: {} });
    expect(invalid.status).toBe(422);
    expectValid('ErrorResponse', invalid.payload);
  });

  it.each(['en', 'ar'])('order answers (%s)', (locale) => {
    const { call } = api(locale);

    const firstPage = call('GET', '/orders', null, 'perPage=10');
    expectValid('OrdersResponse', firstPage.payload);
    expect(firstPage.payload.data.pagination).toEqual({ page: 1, perPage: 10, total: 12, totalPages: 2 });
    expectValid('OrdersResponse', call('GET', '/orders', null, 'page=2&perPage=10').payload);

    for (const summary of firstPage.payload.data.items) expectValid('OrderResponse', call('GET', `/orders/${summary.id}`).payload);

    expectValid('CancellationReasonsResponse', call('GET', '/orders/cancellation-reasons').payload);
    expectValid('OrderResponse', call('POST', '/orders/mock-order-48201/cancel', { reasonId: 2, note: null }).payload);
    const conflict = call('POST', '/orders/mock-order-48201/cancel', { reasonId: 2 });
    expect(conflict.status).toBe(409);
    expectValid('ErrorResponse', conflict.payload);
    expectValid('ReorderResponse', call('POST', '/orders/mock-order-48200/reorder').payload);

    const missing = call('GET', '/orders/nope');
    expect(missing.status).toBe(404);
    expectValid('ErrorResponse', missing.payload);
  });

  it('answers 401 without a session and leaves other paths alone', () => {
    const { call } = api('en', null);
    const anonymous = call('GET', '/orders');
    expect(anonymous.status).toBe(401);
    expect(anonymous.payload.error.code).toBe('unauthenticated');

    const account = createAccountModule(createShopperStore());
    expect(account.handle({ method: 'GET', pathname: '/cart', query: new URLSearchParams(), token: 'test-customer', locale: 'en', body: null })).toBeNull();
    const answers = createModules(createShopperStore()).map((part) => part.handle({ method: 'GET', pathname: '/orders', query: new URLSearchParams(), token: 'test-customer', locale: 'en', body: null }));
    expect(answers.some(Boolean)).toBe(true);
  });
});

describe('mock address book', () => {
  it('validates required fields and required location levels with 422 fields', () => {
    const { call } = api();
    const noCity = call('POST', '/addresses', { values: {} });
    expect(noCity.payload.error.fields).toMatchObject({ cityId: ['Choose a city.'], street: ['Street is required.'], building: ['Building is required.'], phone: ['Phone is required.'] });

    const noArea = call('POST', '/addresses', newAddress({ areaId: null }));
    expect(noArea.status).toBe(422);
    expect(noArea.payload.error.fields).toEqual({ areaId: ['Choose an area.'] });

    const wrongPhone = call('POST', '/addresses', newAddress({ values: { street: 'X', building: '1', phone: '123' } }));
    expect(wrongPhone.payload.error.fields).toEqual({ phone: ['Enter a mobile number of 11 digits.'] });
    expect(call('GET', '/addresses').payload.data.items).toHaveLength(1);
  });

  it('answers in Arabic', () => {
    const { call } = api('ar');
    expect(call('POST', '/addresses', newAddress({ areaId: null })).payload.error).toMatchObject({ message: 'يرجى مراجعة الحقول المحددة.', fields: { areaId: ['اختر المنطقة.'] } });
  });

  it('gives an edited address a new id', () => {
    const { call } = api();
    const saved = call('PUT', '/addresses/501', newAddress({ areaId: 21 })).payload.data;
    expect(saved.address.id).not.toBe(501);
    expect(saved.address.isDefault).toBe(true);
    expect(saved.items.map((a) => a.id)).toEqual([saved.address.id]);
    expect(call('PUT', '/addresses/501', newAddress()).status).toBe(404);
  });

  it('deleting the default makes another address the default', () => {
    const { call } = api();
    const second = call('POST', '/addresses', newAddress()).payload.data.address;
    expect(second.isDefault).toBe(false);

    const after = call('DELETE', '/addresses/501').payload.data.items;
    expect(after).toEqual([expect.objectContaining({ id: second.id, isDefault: true })]);
  });

  it('keeps the default first and moves it on request', () => {
    const { call } = api();
    const second = call('POST', '/addresses', newAddress()).payload.data.address;
    const items = call('POST', `/addresses/${second.id}/default`).payload.data.items;
    expect(items.map((a) => [a.id, a.isDefault])).toEqual([
      [second.id, true],
      [501, false],
    ]);
  });

  it("answers 404 for someone else's address", () => {
    const { call, guest } = api();
    guest();
    expect(call('DELETE', '/addresses/501').status).toBe(404);
    expect(call('POST', '/addresses/501/default').status).toBe(404);
    expect(call('GET', '/addresses').payload.data.items).toEqual([]);
  });
});

describe('mock orders', () => {
  it('seeds the customer history once: in progress, delivered, picked up, cancelled, two pages', () => {
    const { call } = api();
    const items = call('GET', '/orders', null, 'perPage=10').payload.data.items;
    expect(items.slice(0, 4).map((o) => [o.number, o.status.code])).toEqual([
      ['48201', 'processing'],
      ['48200', 'delivered'],
      ['48199', 'picked_up'],
      ['48198', 'cancelled'],
    ]);
    expect(call('GET', '/orders').payload.data.pagination.total).toBe(12);

    const inProgress = call('GET', '/orders/mock-order-48201').payload.data;
    expect(inProgress.actions).toEqual({ canCancel: true, canReorder: false, canRate: false, canReviewProducts: false });
    expect(inProgress.timeline.filter((step) => step.current)).toHaveLength(1);
    expect(inProgress.totals.lines.map((line) => line.kind)).toEqual(['subtotal', 'promo_code', 'delivery']);
    expect(inProgress.totals.lines[1].amount.display).toBe('-20.00 EGP');
    expect(inProgress.totals.total.display).toBe('408.00 EGP');
    expect(inProgress.items[1]).toMatchObject({ lineTotal: { display: '243 EGP' }, compareAt: { display: '270 EGP' } });

    const pickup = call('GET', '/orders/mock-order-48199').payload.data;
    expect(pickup.fulfilment).toMatchObject({ type: 'pickup', address: null, branch: { name: 'Nasr City branch' } });
    expect(pickup.totals.lines.at(-1)).toEqual({ kind: 'delivery', label: 'Pickup from the branch', amount: null, text: 'Free' });
    expect(pickup.timeline).toEqual([]);
  });

  it('guests have no orders until they place one', () => {
    const { call, guest, session } = api();
    guest();
    expect(call('GET', '/orders').payload.data.items).toEqual([]);
    const placed = call('GET', '/orders/mock-order-48200', null);
    expect(placed.status).toBe(404);
    // the checkout module adds orders like this
    orderRows(session()).unshift({ en: { id: 'mock-order-1', number: '1' }, ar: { id: 'mock-order-1', number: '1' } });
    expect(call('GET', '/orders/mock-order-1').payload.data.number).toBe('1');
  });

  it('cancelling changes the status and the actions; a second cancel is refused with 409', () => {
    const { call } = api();
    expect(call('POST', '/orders/mock-order-48201/cancel', {}).status).toBe(422);
    const cancelled = call('POST', '/orders/mock-order-48201/cancel', { reasonId: 1, note: 'Ordered twice' }).payload.data;
    expect(cancelled.status).toEqual({ code: 'cancelled', label: 'Cancelled', active: false });
    expect(cancelled.actions).toEqual({ canCancel: false, canReorder: false, canRate: false, canReviewProducts: false });

    const again = call('POST', '/orders/mock-order-48201/cancel', { reasonId: 1 });
    expect(again.status).toBe(409);
    expect(again.payload.error).toEqual({ code: 'cannot_cancel', message: 'This order can no longer be cancelled.' });
    expect(call('POST', '/orders/mock-order-48200/cancel', { reasonId: 1 }).status).toBe(409);
  });

  it('ordering again fills the cart and reports the product that is not sold any more', () => {
    const { call, store } = api('ar');
    const before = store.session('test-customer').cart.size;
    const result = call('POST', '/orders/mock-order-48200/reorder').payload.data;
    expect(result.skipped).toEqual([{ name: 'مناديل أطفال مبللة للسفر', reason: 'هذا المنتج لم يعد متاحاً للبيع.' }]);
    expect(result.cart.items.length).toBe(before + 1);
  });
});

describe('mock orders extras (tracking, rating, reviews)', () => {
  it.each(['en', 'ar'])('answers follow the contract (%s)', (locale) => {
    const { call } = api(locale);
    expectValid('OrderResponse', call('GET', '/orders/track', null, 'number=48200&phone=01000000001').payload);
    expectValid('OrderResponse', call('POST', '/orders/mock-order-48200/rate', { rating: 4, driverRating: 5, feedback: 'Fast', skip: false, items: [] }).payload);
    const written = call('POST', '/reviews', { productId: call('GET', '/orders/mock-order-48200').payload.data.items[0].productId, rating: 5, comment: 'Great', orderId: 'mock-order-48200' });
    expect(written.status).toBe(201);
    expectValid('MessageResponse', written.payload);
  });

  it('tracks an order by number + phone without a session, and never says which half was wrong', () => {
    const { call } = api('en', null);
    const found = call('GET', '/orders/track', null, 'number=48200&phone=01000000001').payload.data;
    expect(found.number).toBe('48200');
    expect(found.phone).toBe('01••••••001');
    expect(call('GET', '/orders/track', null, 'number=48200&phone=%2B20%201000000001').status).toBe(200);
    expect(call('GET', '/orders/track', null, 'number=48200&phone=01099999999').status).toBe(404);
    expect(call('GET', '/orders/track', null, 'number=99999&phone=01000000001').status).toBe(404);
    expect(call('GET', '/orders/track', null, 'number=48200').status).toBe(422);
  });

  it('rates a delivered order once; the rating then shows and canRate turns false', () => {
    const { call } = api();
    const before = call('GET', '/orders/mock-order-48200').payload.data;
    expect(before.actions).toMatchObject({ canRate: true, canReviewProducts: true });
    expect(before.ratingForm).toEqual({ driverRating: 'optional', items: true });
    expect(before.rating).toBeNull();

    expect(call('POST', '/orders/mock-order-48200/rate', { rating: 9 }).status).toBe(422);
    const rated = call('POST', '/orders/mock-order-48200/rate', { rating: 4, driverRating: 5, feedback: ' Fast ', skip: false }).payload.data;
    expect(rated.rating).toEqual({ rating: 4, driverRating: 5, feedback: 'Fast' });
    expect(rated.actions.canRate).toBe(false);
    expect(rated.ratingForm).toBeNull();

    const again = call('POST', '/orders/mock-order-48200/rate', { rating: 3 });
    expect(again.status).toBe(409);
    expect(again.payload.error.code).toBe('already_rated');
    expect(call('POST', '/orders/mock-order-48201/rate', { rating: 3 }).payload.error.code).toBe('cannot_rate');
    // the picked-up order is rated already (seeded), with no delivery stars
    expect(call('GET', '/orders/mock-order-48199').payload.data.rating).toEqual({ rating: 5, driverRating: null, feedback: 'Quick and friendly' });
  });

  it('"not now" keeps the order rateable', () => {
    const { call } = api();
    const skipped = call('POST', '/orders/mock-order-48200/rate', { rating: null, skip: true }).payload.data;
    expect(skipped.rating).toBeNull();
    expect(skipped.actions.canRate).toBe(true);
  });

  it('writes a review from a delivered order or from the product page, and refuses what the backend refuses', () => {
    const { call, store } = api();
    const account = createAccountModule(store);
    const productId = call('GET', '/orders/mock-order-48200').payload.data.items[0].productId;
    expect(call('POST', '/reviews', { productId, rating: 0, comment: '' }).payload.error.fields).toEqual({ rating: ['Choose a rating from 1 to 5.'], comment: ['Write a few words about the product.'] });
    expect(call('POST', '/reviews', { productId: 424242, rating: 5, comment: 'x' }).status).toBe(404);
    expect(call('POST', '/reviews', { productId, rating: 5, comment: 'x', orderId: 'mock-order-48201' }).payload.error.fields).toEqual({ orderId: ['Choose one of your delivered orders to review this product.'] });
    expect(call('POST', '/reviews', { productId, rating: 5, comment: 'Great' }).status).toBe(201);
    expect(createAccountModule(store).reviewsWritten()).toEqual([]);
    void account;
  });
});
