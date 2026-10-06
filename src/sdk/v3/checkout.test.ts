import { describe, expect, it, vi } from 'vitest';
import checkoutEn from '../../test/fixtures/v3/checkout.en.json';
import checkoutPickupEn from '../../test/fixtures/v3/checkout-pickup.en.json';
import { ApiError } from '../errors';
import {
  checkoutSelections,
  computeCheckout,
  freshCheckout,
  getCheckoutResult,
  getPickupBranches,
  isCheckout,
  placeOrder,
  setCheckoutContact,
  uploadFile,
} from './checkout';
import { createStorefrontClient } from './http';
import type { Checkout } from './types';

const ROOT = 'https://api.test/api/customer/v3/';
const ctx = { locale: 'en' as const, token: 'guest-1' };
const ready = () => structuredClone(checkoutEn.data) as Checkout;
const pickup = () => structuredClone(checkoutPickupEn.data) as Checkout;

function setup(status = 200, body: unknown = { data: { ok: true } }) {
  const fetch = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  const client = createStorefrontClient({ baseUrl: 'https://api.test', apiKey: 'k', fetch, revalidate: 60 });
  const lastCall = () => {
    const [url, init] = fetch.mock.calls.at(-1)!;
    return { url: String(url), init: init!, headers: init!.headers as Record<string, string>, json: () => JSON.parse(String(init!.body)) as Record<string, unknown> };
  };
  return { fetch, client, lastCall };
}

describe('checkout SDK', () => {
  it('computes the checkout for the choices it is given, and sends no prices', async () => {
    const { client, lastCall } = setup(200, { data: ready() });
    const selections = { fulfilment: 'pickup' as const, branchId: 71, promoCode: 'SAVE10' };

    await expect(computeCheckout(client, ctx, selections)).resolves.toEqual(ready());

    const { url, init, headers, json } = lastCall();
    expect(url).toBe(`${ROOT}checkout`);
    expect(init.method).toBe('POST');
    expect(headers).toMatchObject({ Authorization: 'Bearer guest-1', 'Accept-Language': 'en', 'Content-Type': 'application/json' });
    expect(json()).toEqual(selections);
    expect(init.cache).toBe('no-store');
  });

  it('the first call sends no choices', async () => {
    const { client, lastCall } = setup(200, { data: ready() });
    await computeCheckout(client, { locale: 'ar', token: 'cust' });
    expect(lastCall().json()).toEqual({});
    expect(lastCall().headers['Accept-Language']).toBe('ar');
  });

  it('reads the choices back from the echo of a checkout', () => {
    expect(checkoutSelections(ready())).toEqual({
      fulfilment: 'delivery',
      addressId: 501,
      branchId: null,
      paymentMethodId: 1,
      installmentPlanId: null,
      promoCode: null,
      prescriptionFiles: [],
      useWallet: false,
    });

    const withFiles = pickup();
    withFiles.payment.selected = { methodId: 4, planId: 42 };
    withFiles.requirements.prescription = { required: true, files: [{ id: 'up-1', name: 'a.jpg' }, { id: 'up-2', name: 'b.pdf' }] };
    expect(checkoutSelections(withFiles)).toEqual({
      fulfilment: 'pickup',
      addressId: null,
      branchId: 71,
      paymentMethodId: 4,
      installmentPlanId: 42,
      promoCode: 'SAVE10',
      prescriptionFiles: ['up-1', 'up-2'],
      useWallet: false,
    });

    const nothingChosen = ready();
    nothingChosen.fulfilment = { ...nothingChosen.fulfilment, selected: null, addressId: null };
    nothingChosen.payment.selected = null;
    expect(checkoutSelections(nothingChosen)).toMatchObject({ fulfilment: null, addressId: null, branchId: null, paymentMethodId: null, installmentPlanId: null });
  });

  it('places the order with exactly the choices and the total of the checkout it is given', async () => {
    const { client, lastCall } = setup(200, { data: { next: { type: 'done', url: null, reference: 'r-1' }, order: null } });
    const checkout = ready();
    // an amount no formula would produce: it must be passed through untouched
    checkout.totals.total = { amount: 381.015, currency: 'EGP', display: 'TOTAL-TEXT' };

    const answer = await placeOrder(client, ctx, { checkout, acceptTerms: true, returnUrl: 'https://shop.test/en/checkout/result', idempotencyKey: 'key-1', note: '  Ring twice ' });

    expect(answer.next.reference).toBe('r-1');
    const { url, init, headers, json } = lastCall();
    expect(url).toBe(`${ROOT}orders`);
    expect(init.method).toBe('POST');
    expect(headers).toMatchObject({ 'Idempotency-Key': 'key-1', Authorization: 'Bearer guest-1', 'api-key': 'k' });
    expect(json()).toEqual({
      selections: { ...checkoutSelections(checkout), note: 'Ring twice' },
      expectedTotal: 381.015,
      acceptTerms: true,
      returnUrl: 'https://shop.test/en/checkout/result',
    });
  });

  it('sends acceptPaymentChange only after the shopper accepted the change', async () => {
    const { client, lastCall } = setup(200, { data: { next: { type: 'done', url: null, reference: 'r-1' }, order: null } });

    await placeOrder(client, ctx, { checkout: ready(), acceptTerms: true, returnUrl: null, idempotencyKey: 'k1' });
    expect(lastCall().json().selections).not.toHaveProperty('acceptPaymentChange');
    expect((lastCall().json().selections as Record<string, unknown>).note).toBeNull();

    await placeOrder(client, ctx, { checkout: ready(), acceptTerms: true, returnUrl: null, idempotencyKey: 'k2', acceptPaymentChange: true });
    expect(lastCall().json().selections).toMatchObject({ acceptPaymentChange: true });
  });

  it('an extra header can never replace the standard ones', async () => {
    const { client, lastCall } = setup();
    await client.request('GET', 'me', { locale: 'ar', token: 't', headers: { Authorization: 'Bearer other', 'Accept-Language': 'en', 'X-Extra': '1' } });
    expect(lastCall().headers).toMatchObject({ Authorization: 'Bearer t', 'Accept-Language': 'ar', 'X-Extra': '1' });
  });

  it.each(['total_changed', 'checkout_incomplete', 'payment_change_needs_consent'] as const)('%s carries the fresh checkout', async (code) => {
    const fresh = pickup();
    const { client } = setup(409, { error: { code, message: 'Please review your order.' }, checkout: fresh });

    const error = await placeOrder(client, ctx, { checkout: ready(), acceptTerms: true, returnUrl: null, idempotencyKey: 'k' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: code, message: 'Please review your order.' });
    expect(freshCheckout(error as ApiError)).toEqual(fresh);
  });

  it.each([
    ['order_in_progress', 409],
    ['payment_provider_error', 502],
    ['guest_checkout_disabled', 403],
  ] as const)('%s has no checkout', async (code, status) => {
    const { client } = setup(status, { error: { code, message: 'No.' } });
    const error = await placeOrder(client, ctx, { checkout: ready(), acceptTerms: true, returnUrl: null, idempotencyKey: 'k' }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: code, message: 'No.' });
    expect(freshCheckout(error as ApiError)).toBeNull();
  });

  it('knows a checkout from something else', () => {
    expect(isCheckout(ready())).toBe(true);
    expect(isCheckout(null)).toBe(false);
    expect(isCheckout({ canPlaceOrder: true })).toBe(false);
    expect(isCheckout({ ...ready(), totals: { lines: [], total: { amount: '381', currency: 'EGP', display: '381.00 EGP' } } })).toBe(false);
    expect(freshCheckout(new ApiError('total_changed', 409, 'Changed', {}, undefined, { checkout: { canPlaceOrder: true } }))).toBeNull();
  });

  it('asks for the result of a reference', async () => {
    const { client, lastCall } = setup(200, { data: { status: 'pending', message: null, order: null, retry: false } });

    await expect(getCheckoutResult(client, ctx, 'ref 1/2')).resolves.toMatchObject({ status: 'pending' });

    const { url, init, headers } = lastCall();
    expect(url).toBe(`${ROOT}checkout/result?ref=ref+1%2F2`);
    expect(init.method).toBe('GET');
    expect(headers.Authorization).toBe('Bearer guest-1');
    expect(init.cache).toBe('no-store');
  });

  it('saves the guest contact', async () => {
    const saved = { isGuest: true, name: 'Mona Ali', phone: '01234567890', email: null };
    const { client, lastCall } = setup(200, { data: saved });
    const contact = { firstName: 'Mona', lastName: 'Ali', phone: '01234567890', email: null };

    await expect(setCheckoutContact(client, ctx, contact)).resolves.toEqual(saved);

    expect(lastCall().url).toBe(`${ROOT}checkout/contact`);
    expect(lastCall().init.method).toBe('PUT');
    expect(lastCall().json()).toEqual(contact);
  });

  it('lists the pickup branches', async () => {
    const items = [{ id: 71, name: 'Nasr City branch', address: null, phone: null, mapUrl: null }];
    const { client, lastCall } = setup(200, { data: { items } });

    await expect(getPickupBranches(client, ctx)).resolves.toEqual(items);

    expect(lastCall().url).toBe(`${ROOT}pickup-branches`);
    expect(lastCall().headers.Authorization).toBe('Bearer guest-1');
  });

  it('uploads a file in the `file` field', async () => {
    const { client, lastCall } = setup(201, { data: { id: 'up-1', name: 'prescription.jpg' } });

    await expect(uploadFile(client, ctx, new Blob(['data'], { type: 'image/jpeg' }), 'prescription.jpg')).resolves.toEqual({ id: 'up-1', name: 'prescription.jpg' });

    const { url, init, headers } = lastCall();
    expect(url).toBe(`${ROOT}uploads`);
    expect(init.method).toBe('POST');
    expect(headers['Content-Type']).toBeUndefined();
    const file = (init.body as FormData).get('file') as File;
    expect(file.name).toBe('prescription.jpg');
    expect(headers.Authorization).toBe('Bearer guest-1');
  });
});
