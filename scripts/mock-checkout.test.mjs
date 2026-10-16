import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { orderRows } from './mock/account-state.mjs';
import { createCheckoutModule, PAYMENT, PHONE_IN_USE, PRESCRIPTION_PRODUCT_ID, PROMO } from './mock/checkout.mjs';
import { createModules } from './mock/modules.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const RETURN_URL = 'http://127.0.0.1:3200/en/checkout/result';

/** A mock API made of the checkout module and the shopper store, with a clock the test controls. */
function api(locale = 'en') {
  const store = createShopperStore();
  let time = 1_000_000;
  const checkout = createCheckoutModule(store, { now: () => time, pendingMs: 4000 });
  checkout.reset();
  let token = 'test-customer';
  const call = (method, pathname, body = null, { query = '', headers = {}, contentType = '', raw = '' } = {}) => {
    const request = { method, pathname, query: new URLSearchParams(query), token, locale, body, contentType, headers: { host: '127.0.0.1:4010', ...headers }, raw };
    const [status, payload, responseHeaders] = checkout.handle(request) ?? store.handle(request);
    return { status, payload, headers: responseHeaders ?? {} };
  };
  return {
    call,
    store,
    checkout,
    as(value) {
      token = value;
    },
    guest() {
      token = call('POST', '/session/guest').payload.data.token;
      return token;
    },
    wait(ms) {
      time += ms;
    },
    /** POST /checkout, checked against the contract. */
    compute(selections = null) {
      const { status, payload } = call('POST', '/checkout', selections);
      expect(status).toBe(200);
      expect(validate('CheckoutResponse', payload)).toEqual([]);
      return payload.data;
    },
    /** POST /orders for a computed checkout, like the storefront sends it. */
    place(checkout, extra = {}, headers = {}) {
      const selections = {
        fulfilment: checkout.fulfilment.selected,
        addressId: checkout.fulfilment.addressId,
        branchId: checkout.fulfilment.branch?.id ?? null,
        paymentMethodId: checkout.payment.selected?.methodId ?? null,
        installmentPlanId: checkout.payment.selected?.planId ?? null,
        promoCode: checkout.promo.code,
        prescriptionFiles: checkout.requirements.prescription.files.map((file) => file.id),
        ...extra.selections,
      };
      const body = { selections, expectedTotal: checkout.totals.total.amount, acceptTerms: true, returnUrl: RETURN_URL, ...extra.body };
      const answer = call('POST', '/orders', body, { headers });
      expect(validate(answer.status === 200 ? 'PlaceOrderResponse' : 'ErrorResponse', answer.payload)).toEqual([]);
      return answer;
    },
    result(reference) {
      const answer = call('GET', '/checkout/result', null, { query: `ref=${reference}` });
      expect(validate(answer.status === 200 ? 'CheckoutResultResponse' : 'ErrorResponse', answer.payload)).toEqual([]);
      return answer;
    },
    /** The seeded cart is below the 300 EGP minimum: 356 EGP after this. */
    fillCart() {
      call('PUT', '/cart/items/7346', { quantity: 2 });
    },
  };
}

const upload = (mock, name) => mock.call('POST', '/uploads', null, { contentType: 'multipart/form-data; boundary=x', raw: `--x\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\n\r\ndata\r\n--x--` });

describe.each(['en', 'ar'])('mock checkout API follows the contract (%s)', (locale) => {
  it('needs a shopper session', () => {
    const mock = api(locale);
    mock.as(null);
    for (const [method, pathname] of [['POST', '/checkout'], ['POST', '/orders'], ['GET', '/checkout/result'], ['PUT', '/checkout/contact'], ['GET', '/pickup-branches'], ['POST', '/uploads']]) {
      const answer = mock.call(method, pathname);
      expect(answer.status).toBe(401);
      expect(validate('ErrorResponse', answer.payload)).toEqual([]);
      expect(answer.payload.error.code).toBe('unauthenticated');
    }
  });

  it('first call: preselects delivery to the default address and explains what is missing', () => {
    const mock = api(locale);

    const first = mock.compute();

    expect(first.fulfilment.selected).toBe('delivery');
    expect(first.fulfilment.addressId).toBe(501);
    expect(first.fulfilment.delivery.fee.amount).toBe(25);
    expect(first.payment.selected).toBeNull();
    expect(first.missing.map((item) => item.code)).toEqual(['payment_method']);
    expect(first.blockers.map((item) => item.code)).toEqual(['minimum_order']);
    expect(first.minimumOrder.progressPercent).toBe(65);
    expect(first.canPlaceOrder).toBe(false);
    // computing never writes: the same question gets the same answer
    expect(mock.compute()).toEqual(first);
  });

  it('a minimum that counts delivery: goods under the cart minimum are refused from the first render', () => {
    const mock = api(locale);
    mock.call('POST', '/__checkout', { minimumIncludesDelivery: true });
    mock.guest();
    mock.call('PUT', '/cart/items/36480', { quantity: 2 });

    const first = mock.compute();
    expect(first.fulfilment.selected).toBeNull();
    expect(first.missing.map((item) => item.code)).toContain('fulfilment');
    expect(first.blockers.map((item) => item.code)).toEqual(['minimum_order']);
    expect(first.minimumOrder.remaining.amount).toBe(264);
    expect(first.cart.checkout.blockers.map((item) => item.code)).toEqual(['minimum_order']);

    const pickup = mock.compute({ fulfilment: 'pickup', branchId: 71 });
    expect(pickup.blockers.map((item) => item.code)).toEqual(['minimum_order']);
    expect(pickup.minimumOrder.remaining.amount).toBe(264);
  });

  it('seif: goods 290 + delivery 25 = 315 is over the 300 minimum, yet the order is refused like the old storefront', () => {
    const mock = api(locale);
    mock.call('POST', '/__checkout', { minimumIncludesDelivery: true });
    mock.call('DELETE', '/cart');
    mock.call('PUT', '/cart/items/8658', { quantity: 1 });
    mock.call('PUT', '/cart/items/36480', { quantity: 5 });

    const delivery = mock.compute({ fulfilment: 'delivery', addressId: 501, paymentMethodId: 1 });
    expect(delivery.totals.total.amount).toBe(315);
    expect(delivery.blockers.map((item) => item.code)).toEqual(['minimum_order']);
    expect(delivery.blockers[0].message).toBe(
      locale === 'en' ? 'The minimum order is 300.00 EGP. Add 10.00 EGP more to place your order.' : 'الحد الأدنى للطلب 300.00 جنية. أضف 10.00 جنية لإتمام الطلب.'
    );
    expect(delivery.minimumOrder.remaining.amount).toBe(10);
    expect(delivery.canPlaceOrder).toBe(false);
  });

  it('checkout lines have 2 decimals, the cart lines read like prices', () => {
    const mock = api(locale);
    mock.fillCart();
    const cart = mock.call('GET', '/cart').payload.data;
    const checkout = mock.compute();
    const label = locale === 'en' ? 'EGP' : 'جنية';
    checkout.cart.items.forEach((item, i) => {
      expect(item.lineTotal.amount).toBe(cart.items[i].lineTotal.amount);
      expect(item.lineTotal.display).toMatch(new RegExp(`^[0-9,]+\\.[0-9]{2} ${label}$`));
    });
    expect(cart.items.some((item) => !/\.[0-9]{2} /.test(item.lineTotal.display))).toBe(true);
  });

  it('delivery has a fee, pickup is free text and needs a branch', () => {
    const mock = api(locale);
    mock.fillCart();

    const branches = mock.call('GET', '/pickup-branches');
    expect(validate('PickupBranchesResponse', branches.payload)).toEqual([]);
    expect(branches.payload.data.items).toHaveLength(2);

    const noBranch = mock.compute({ fulfilment: 'pickup', paymentMethodId: PAYMENT.cash });
    expect(noBranch.fulfilment.delivery).toBeNull();
    expect(noBranch.missing.map((item) => item.code)).toEqual(['branch']);

    const pickup = mock.compute({ fulfilment: 'pickup', branchId: 71, paymentMethodId: PAYMENT.cash });
    expect(pickup.fulfilment.branch.id).toBe(71);
    expect(pickup.fulfilment.delivery).toMatchObject({ fee: null, free: true });
    expect(pickup.totals.lines.find((line) => line.kind === 'delivery')).toMatchObject({ amount: null, text: pickup.fulfilment.delivery.text });
    expect(pickup.totals.total.amount).toBe(356);
    expect(pickup.canPlaceOrder).toBe(true);

    const delivery = mock.compute({ fulfilment: 'delivery', paymentMethodId: PAYMENT.cash });
    expect(delivery.totals.total.amount).toBe(381);

    const unknownBranch = mock.compute({ fulfilment: 'pickup', branchId: 999 });
    expect(unknownBranch.fulfilment.branch).toBeNull();
    expect(unknownBranch.messages).toHaveLength(1);

    mock.call('POST', '/__checkout', { pickup: false });
    const closed = mock.compute({ fulfilment: 'pickup', branchId: 71 });
    expect(closed.fulfilment.options.find((option) => option.type === 'pickup')).toMatchObject({ available: false });
    expect(closed.fulfilment.options.find((option) => option.type === 'pickup').reason).toBeTruthy();
    expect(closed.fulfilment.selected).toBeNull();
    expect(closed.missing.map((item) => item.code)).toContain('fulfilment');
  });

  it('drops an address the store does not deliver to, with a message', () => {
    const mock = api(locale);
    mock.fillCart();
    mock.checkout.addAddress('test-customer', { id: 777, isDefault: false, cityId: 2, areaId: 22, districtId: null, values: { street: 'Desert Rd', building: '1', phone: '01000000002' } });

    const dropped = mock.compute({ fulfilment: 'delivery', addressId: 777, paymentMethodId: PAYMENT.cash });

    expect(dropped.fulfilment.addresses.find((address) => address.id === 777).deliverable).toBe(false);
    expect(dropped.fulfilment.addressId).toBeNull();
    expect(dropped.messages).toEqual([{ level: 'warning', text: expect.any(String) }]);
    expect(dropped.missing.map((item) => item.code)).toEqual(['address']);
    expect(dropped.canPlaceOrder).toBe(false);

    const deleted = mock.compute({ fulfilment: 'delivery', addressId: 123456 });
    expect(deleted.fulfilment.addressId).toBeNull();
    expect(deleted.messages).toHaveLength(1);
  });

  it('payment methods: a fee, installment plans, and a dropped method', () => {
    const mock = api(locale);
    mock.fillCart();

    const withFee = mock.compute({ paymentMethodId: PAYMENT.cardOnDelivery });
    expect(withFee.payment.methods.find((method) => method.id === PAYMENT.cardOnDelivery).fee.amount).toBe(10);
    expect(withFee.totals.lines.map((line) => line.kind)).toEqual(['subtotal', 'delivery', 'payment_fee']);
    expect(withFee.totals.total.amount).toBe(391);

    const noPlan = mock.compute({ paymentMethodId: PAYMENT.installments });
    expect(noPlan.payment.selected).toEqual({ methodId: PAYMENT.installments, planId: null });
    expect(noPlan.missing.map((item) => item.code)).toEqual(['installment_plan']);
    const withPlan = mock.compute({ paymentMethodId: PAYMENT.installments, installmentPlanId: 42 });
    expect(withPlan.payment.selected.planId).toBe(42);
    expect(withPlan.canPlaceOrder).toBe(true);

    mock.call('POST', '/__checkout', { cardDown: true });
    const dropped = mock.compute({ paymentMethodId: PAYMENT.cardOnline });
    expect(dropped.payment.methods.map((method) => method.id)).not.toContain(PAYMENT.cardOnline);
    expect(dropped.payment.selected).toBeNull();
    expect(dropped.messages).toHaveLength(1);
    expect(dropped.missing.map((item) => item.code)).toEqual(['payment_method']);
  });

  it('promo codes: a discount line, free delivery, and an invalid code that blocks the order', () => {
    const mock = api(locale);
    mock.fillCart();

    const percent = mock.compute({ paymentMethodId: PAYMENT.cash, promoCode: PROMO.percent });
    expect(percent.promo).toMatchObject({ code: PROMO.percent, applied: true });
    const line = percent.totals.lines.find((item) => item.kind === 'promo_code');
    expect(line.amount.amount).toBe(-35.6);
    expect(line.amount.display.startsWith('-')).toBe(true);
    expect(percent.totals.total.amount).toBe(345.4);

    const free = mock.compute({ paymentMethodId: PAYMENT.cash, promoCode: PROMO.freeDelivery });
    expect(free.promo.applied).toBe(true);
    expect(free.fulfilment.delivery).toMatchObject({ fee: null, free: true });
    expect(free.totals.total.amount).toBe(356);

    const invalid = mock.compute({ paymentMethodId: PAYMENT.cash, promoCode: 'NOPE' });
    expect(invalid.promo).toMatchObject({ code: 'NOPE', applied: false });
    expect(invalid.promo.message).toBeTruthy();
    expect(invalid.blockers.map((item) => item.code)).toEqual(['promo_invalid']);
    expect(invalid.canPlaceOrder).toBe(false);
  });

  it('a cart that needs a prescription asks for an uploaded file', () => {
    const mock = api(locale);
    mock.fillCart();
    mock.call('PUT', `/cart/items/${PRESCRIPTION_PRODUCT_ID}`, { quantity: 1 });

    const before = mock.compute({ paymentMethodId: PAYMENT.cash });
    expect(before.requirements.prescription).toEqual({ required: true, files: [] });
    expect(before.cart.requiresPrescription).toBe(true);
    expect(before.missing.map((item) => item.code)).toEqual(['prescription']);

    const bad = upload(mock, 'notes.txt');
    expect(bad.status).toBe(422);
    expect(validate('ErrorResponse', bad.payload)).toEqual([]);
    expect(bad.payload.error.fields.file).toHaveLength(1);
    expect(mock.call('POST', '/uploads').status).toBe(422);

    const file = upload(mock, 'prescription.jpg');
    expect(file.status).toBe(201);
    expect(file.payload.data).toEqual({ id: expect.any(String), name: 'prescription.jpg' });

    const after = mock.compute({ paymentMethodId: PAYMENT.cash, prescriptionFiles: [file.payload.data.id, 'someone-elses-file'] });
    expect(after.requirements.prescription.files).toEqual([file.payload.data]);
    expect(after.canPlaceOrder).toBe(true);
  });

  it('a guest gives contact details first', () => {
    const mock = api(locale);
    mock.guest();
    mock.call('PUT', '/cart/items/8658', { quantity: 2 });

    const before = mock.compute();
    expect(before.contact).toEqual({ isGuest: true, name: null, phone: null, email: null });
    expect(before.missing.map((item) => item.code)).toEqual(['contact', 'fulfilment', 'payment_method']);

    const invalid = mock.call('PUT', '/checkout/contact', { firstName: '', lastName: 'Ali', phone: '12', email: 'nope' });
    expect(invalid.status).toBe(422);
    expect(validate('ErrorResponse', invalid.payload)).toEqual([]);
    expect(Object.keys(invalid.payload.error.fields).sort()).toEqual(['email', 'firstName', 'phone']);

    const taken = mock.call('PUT', '/checkout/contact', { firstName: 'Mona', lastName: 'Ali', phone: PHONE_IN_USE });
    expect(taken.status).toBe(409);
    expect(taken.payload.error.code).toBe('phone_in_use');

    const saved = mock.call('PUT', '/checkout/contact', { firstName: 'Mona', lastName: 'Ali', phone: '01234567890', email: null });
    expect(saved.status).toBe(200);
    expect(saved.payload.data).toEqual({ isGuest: true, name: 'Mona Ali', phone: '01234567890', email: null });

    const after = mock.compute({ fulfilment: 'pickup', branchId: 72, paymentMethodId: PAYMENT.cash });
    expect(after.contact.name).toBe('Mona Ali');
    expect(after.canPlaceOrder).toBe(true);

    mock.call('POST', '/__checkout', { guestCheckout: false });
    const closed = mock.compute({ fulfilment: 'pickup', branchId: 72, paymentMethodId: PAYMENT.cash });
    expect(closed.missing.map((item) => item.code)).toEqual(['sign_in']);
    expect(closed.blockers.map((item) => item.code)).toEqual(['guest_checkout_disabled']);
    const refused = mock.place(after);
    expect(refused.status).toBe(403);
    expect(refused.payload.error.code).toBe('guest_checkout_disabled');
    expect(mock.call('PUT', '/checkout/contact', { firstName: 'Mona', lastName: 'Ali', phone: '01234567890' }).status).toBe(403);
  });

  it('an offline order is placed at once, empties the cart and shows up in the orders', () => {
    const mock = api(locale);
    mock.fillCart();
    const checkout = mock.compute({ paymentMethodId: PAYMENT.cash });

    const placed = mock.place(checkout, { selections: { note: '  Ring twice ' } });

    expect(placed.status).toBe(200);
    const { next, order } = placed.payload.data;
    expect(next).toEqual({ type: 'done', url: null, reference: expect.any(String) });
    expect(order.totals.total).toEqual(checkout.totals.total);
    expect(order.items).toHaveLength(2);
    expect(order.note).toBe('Ring twice');
    expect(mock.call('GET', '/cart').payload.data.items).toEqual([]);
    const rows = orderRows(mock.store.session('test-customer'));
    expect(rows).toHaveLength(1);
    expect(validate('Order', rows[0].en)).toEqual([]);
    expect(validate('Order', rows[0].ar)).toEqual([]);

    const result = mock.result(next.reference);
    expect(result.payload.data).toMatchObject({ status: 'placed', retry: false, order: { id: order.id, number: order.number } });
    expect(result.payload.data.message).toBeTruthy();
  });

  it('refuses an order when the total is not the one the shopper saw, and places nothing', () => {
    const mock = api(locale);
    mock.fillCart();
    const seen = mock.compute({ paymentMethodId: PAYMENT.cash });
    mock.call('POST', '/__checkout', { price: { productId: 7346, amount: 170 } });

    const refused = mock.place(seen);

    expect(refused.status).toBe(409);
    expect(refused.payload.error.code).toBe('total_changed');
    expect(refused.payload.checkout.totals.total.amount).toBe(401);
    expect(refused.payload.error.message).toContain(refused.payload.checkout.totals.total.display);
    expect(orderRows(mock.store.session('test-customer'))).toHaveLength(0);
    expect(mock.call('GET', '/cart').payload.data.items).toHaveLength(2);

    // confirming the fresh checkout works
    expect(mock.place(refused.payload.checkout).status).toBe(200);
  });

  it('refuses an order that is not complete, without terms, or without a total', () => {
    const mock = api(locale);
    const incomplete = mock.place(mock.compute());
    expect(incomplete.status).toBe(409);
    expect(incomplete.payload.error.code).toBe('checkout_incomplete');
    expect(incomplete.payload.checkout.canPlaceOrder).toBe(false);

    mock.fillCart();
    const checkout = mock.compute({ paymentMethodId: PAYMENT.cash });
    const noTerms = mock.place(checkout, { body: { acceptTerms: false } });
    expect(noTerms.status).toBe(422);
    expect(noTerms.payload.error.fields.acceptTerms).toHaveLength(1);
    expect(mock.place(checkout, { body: { expectedTotal: undefined } }).status).toBe(422);
    expect(orderRows(mock.store.session('test-customer'))).toHaveLength(0);
  });

  it('asks for consent when the payment method has to change', () => {
    const mock = api(locale);
    mock.fillCart();
    const card = mock.compute({ paymentMethodId: PAYMENT.cardOnline });
    mock.call('POST', '/__checkout', { cardDown: true });

    const asked = mock.place(card);
    expect(asked.status).toBe(409);
    expect(asked.payload.error.code).toBe('payment_change_needs_consent');
    const fresh = asked.payload.checkout;
    expect(fresh.payment.selected.methodId).toBe(PAYMENT.cash);
    expect(fresh.messages).toHaveLength(1);
    expect(fresh.canPlaceOrder).toBe(true);

    // the fresh checkout without the shopper's consent is refused again
    expect(mock.place(fresh).payload.error.code).toBe('payment_change_needs_consent');
    expect(orderRows(mock.store.session('test-customer'))).toHaveLength(0);

    const accepted = mock.place(fresh, { selections: { acceptPaymentChange: true } });
    expect(accepted.status).toBe(200);
    expect(accepted.payload.data.order.payment.online).toBe(false);
  });

  it('answers order_in_progress and payment_provider_error once when switched on', () => {
    const mock = api(locale);
    mock.fillCart();
    const checkout = mock.compute({ paymentMethodId: PAYMENT.cash });

    mock.call('POST', '/__checkout', { nextOrderError: 'order_in_progress' });
    const busy = mock.place(checkout);
    expect([busy.status, busy.payload.error.code]).toEqual([409, 'order_in_progress']);

    mock.call('POST', '/__checkout', { nextOrderError: 'payment_provider_error' });
    const provider = mock.place(checkout);
    expect([provider.status, provider.payload.error.code]).toEqual([502, 'payment_provider_error']);

    expect(orderRows(mock.store.session('test-customer'))).toHaveLength(0);
    expect(mock.place(checkout).status).toBe(200);
  });

  it('a retry with the same Idempotency-Key gets the first answer, not a second order', () => {
    const mock = api(locale);
    mock.fillCart();
    const checkout = mock.compute({ paymentMethodId: PAYMENT.cash });

    const first = mock.place(checkout, {}, { 'idempotency-key': 'attempt-1' });
    const retry = mock.place(checkout, {}, { 'idempotency-key': 'attempt-1' });

    expect(retry.payload).toEqual(first.payload);
    expect(orderRows(mock.store.session('test-customer'))).toHaveLength(1);
    const { orderRequests } = mock.call('GET', '/__checkout').payload;
    expect(orderRequests.map((request) => request.idempotencyKey)).toEqual(['attempt-1', 'attempt-1']);
  });

  it('online payment: redirect to the mock bank, then paid / failed / cancelled', () => {
    const mock = api(locale);
    mock.fillCart();
    const checkout = mock.compute({ paymentMethodId: PAYMENT.cardOnline });

    expect(mock.place(checkout, { body: { returnUrl: null } }).status).toBe(422);

    const started = mock.place(checkout);
    const { next, order } = started.payload.data;
    expect(order).toBeNull();
    expect(next.type).toBe('redirect');
    expect(next.url).toBe(`http://127.0.0.1:4010/api/customer/v3/__pay?ref=${next.reference}`);
    // nothing is ordered until the bank says so
    expect(mock.call('GET', '/cart').payload.data.items).toHaveLength(2);
    expect(mock.result(next.reference).payload.data).toMatchObject({ status: 'pending', order: null });

    const page = mock.call('GET', '/__pay', null, { query: `ref=${next.reference}` });
    expect(page.headers['Content-Type']).toContain('text/html');
    expect(page.payload).toContain(checkout.totals.total.display);

    const failed = mock.call('GET', '/__pay/finish', null, { query: `ref=${next.reference}&outcome=failed` });
    expect(failed.status).toBe(302);
    expect(failed.headers.Location).toBe(`${RETURN_URL}?checkout=${next.reference}`);
    expect(mock.result(next.reference).payload.data).toMatchObject({ status: 'failed', order: null, retry: true });
    expect(mock.call('GET', '/cart').payload.data.items).toHaveLength(2);

    const cancelled = mock.place(checkout).payload.data.next;
    mock.call('GET', '/__pay/finish', null, { query: `ref=${cancelled.reference}&outcome=cancelled` });
    expect(mock.result(cancelled.reference).payload.data).toMatchObject({ status: 'cancelled', retry: true });

    const paid = mock.place(checkout).payload.data.next;
    mock.call('GET', '/__pay/finish', null, { query: `ref=${paid.reference}&outcome=paid` });
    const result = mock.result(paid.reference).payload.data;
    expect(result).toMatchObject({ status: 'paid', retry: false });
    expect(result.order.payment.online).toBe(true);
    expect(mock.call('GET', '/cart').payload.data.items).toEqual([]);
  });

  it('online payment the bank confirms later: pending, then paid', () => {
    const mock = api(locale);
    mock.fillCart();
    const { next } = mock.place(mock.compute({ paymentMethodId: PAYMENT.installments, installmentPlanId: 41 })).payload.data;

    mock.call('GET', '/__pay/finish', null, { query: `ref=${next.reference}&outcome=pending` });
    expect(mock.result(next.reference).payload.data.status).toBe('pending');
    mock.wait(3999);
    expect(mock.result(next.reference).payload.data.status).toBe('pending');
    expect(mock.call('GET', '/cart').payload.data.items).toHaveLength(2);

    mock.wait(1);
    expect(mock.result(next.reference).payload.data).toMatchObject({ status: 'paid', order: { number: expect.any(String) } });
    expect(mock.call('GET', '/cart').payload.data.items).toEqual([]);

    // "stuck": the bank never answers
    mock.fillCart();
    mock.call('PUT', '/cart/items/36480', { quantity: 2 });
    const stuck = mock.place(mock.compute({ paymentMethodId: PAYMENT.cardOnline })).payload.data.next;
    mock.call('GET', '/__pay/finish', null, { query: `ref=${stuck.reference}&outcome=stuck` });
    mock.wait(60_000);
    expect(mock.result(stuck.reference).payload.data.status).toBe('pending');
  });

  it('a result belongs to the shopper who placed it', () => {
    const mock = api(locale);
    mock.fillCart();
    const { next } = mock.place(mock.compute({ paymentMethodId: PAYMENT.cash })).payload.data;

    expect(mock.result('nope').status).toBe(404);
    expect(mock.call('GET', '/checkout/result').status).toBe(404);
    mock.guest();
    expect(mock.result(next.reference).status).toBe(404);
  });
});

describe('mock checkout module', () => {
  it('is part of the mock API and leaves other paths to the next module', () => {
    const modules = createModules(createShopperStore());
    const request = (method, pathname) => ({ method, pathname, locale: 'en', query: new URLSearchParams(), token: 'test-customer', body: null, contentType: '', headers: {}, raw: '' });

    expect(modules.map((part) => part.handle(request('POST', '/checkout'))).some(Boolean)).toBe(true);
    const checkout = createCheckoutModule(createShopperStore());
    expect(checkout.handle(request('GET', '/cart'))).toBeNull();
    expect(checkout.handle(request('GET', '/orders'))).toBeNull();
    expect(checkout.handle(request('GET', '/checkout/settings'))).toBeNull();
  });

  it('reset brings back the seeded prices and switches', () => {
    const store = createShopperStore();
    const checkout = createCheckoutModule(store);
    const request = (method, pathname, body = null) => ({ method, pathname, locale: 'en', query: new URLSearchParams(), token: 'test-customer', body, contentType: '', headers: {}, raw: '' });
    const before = checkout.handle(request('POST', '/checkout'))[1].data.totals.total;

    checkout.handle(request('POST', '/__checkout', { price: { productId: 7346, amount: 500 }, cardDown: true, nextOrderError: 'order_in_progress' }));
    expect(checkout.handle(request('POST', '/checkout'))[1].data.totals.total).not.toEqual(before);

    store.reset();
    checkout.reset();
    expect(checkout.handle(request('POST', '/checkout'))[1].data.totals.total).toEqual(before);
    expect(checkout.handle(request('GET', '/__checkout'))[1].mode).toEqual({ guestCheckout: true, pickup: true, cardDown: false, nextOrderError: null, minimumIncludesDelivery: false });
  });
});
