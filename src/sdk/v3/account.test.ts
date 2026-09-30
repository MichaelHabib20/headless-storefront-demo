import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../errors';
import {
  cancelOrder,
  createAddress,
  deleteAddress,
  getAddresses,
  getOrder,
  getOrderCancellationReasons,
  getOrders,
  reorder,
  setDefaultAddress,
  updateAddress,
} from './account';
import { createStorefrontClient, type StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { AddressInput } from './types';

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
const guestAr: ShopperContext = { locale: 'ar', token: 'guest-1' };
const input: AddressInput = { cityId: 2, areaId: 21, districtId: null, isDefault: true, values: { street: 'Tahrir St', floor: null } };

interface Case {
  name: string;
  call: (client: StorefrontClient) => Promise<unknown>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  ctx: ShopperContext;
}

const CASES: Case[] = [
  { name: 'getAddresses', call: (c) => getAddresses(c, customer), method: 'GET', path: 'addresses', ctx: customer },
  { name: 'createAddress', call: (c) => createAddress(c, guestAr, input), method: 'POST', path: 'addresses', body: input, ctx: guestAr },
  { name: 'updateAddress', call: (c) => updateAddress(c, customer, 501, input), method: 'PUT', path: 'addresses/501', body: input, ctx: customer },
  { name: 'deleteAddress', call: (c) => deleteAddress(c, customer, 501), method: 'DELETE', path: 'addresses/501', ctx: customer },
  { name: 'setDefaultAddress', call: (c) => setDefaultAddress(c, guestAr, 602), method: 'POST', path: 'addresses/602/default', ctx: guestAr },
  { name: 'getOrders', call: (c) => getOrders(c, customer), method: 'GET', path: 'orders', ctx: customer },
  { name: 'getOrders (paged)', call: (c) => getOrders(c, guestAr, { page: 2, perPage: 10 }), method: 'GET', path: 'orders?page=2&perPage=10', ctx: guestAr },
  { name: 'getOrder', call: (c) => getOrder(c, customer, 'mock-order-48201'), method: 'GET', path: 'orders/mock-order-48201', ctx: customer },
  { name: 'getOrder (encodes the id)', call: (c) => getOrder(c, customer, 'a/b c'), method: 'GET', path: 'orders/a%2Fb%20c', ctx: customer },
  { name: 'getOrderCancellationReasons', call: (c) => getOrderCancellationReasons(c, guestAr), method: 'GET', path: 'orders/cancellation-reasons', ctx: guestAr },
  {
    name: 'cancelOrder',
    call: (c) => cancelOrder(c, customer, 'mock-order-48201', { reasonId: 2, note: 'Ordered twice' }),
    method: 'POST',
    path: 'orders/mock-order-48201/cancel',
    body: { reasonId: 2, note: 'Ordered twice' },
    ctx: customer,
  },
  {
    name: 'cancelOrder (no note)',
    call: (c) => cancelOrder(c, customer, 'mock-order-48201', { reasonId: 1 }),
    method: 'POST',
    path: 'orders/mock-order-48201/cancel',
    body: { reasonId: 1, note: null },
    ctx: customer,
  },
  { name: 'reorder', call: (c) => reorder(c, guestAr, 'mock-order-48200'), method: 'POST', path: 'orders/mock-order-48200/reorder', ctx: guestAr },
];

describe('account SDK', () => {
  it.each(CASES)('$name → $method $path', async ({ call, method, path, body, ctx }) => {
    const { client, lastCall } = setup();

    await expect(call(client)).resolves.toEqual({ value: 42 });

    const { url, init, headers } = lastCall();
    expect(url).toBe(ROOT + path);
    expect(init.method).toBe(method);
    expect(headers).toMatchObject({ Authorization: `Bearer ${ctx.token}`, 'Accept-Language': ctx.locale, 'api-key': 'k' });
    if (body === undefined) expect(init.body).toBeUndefined();
    else expect(JSON.parse(String(init.body))).toEqual(body);
    // Personal data is never shared through the framework cache.
    expect(init.cache).toBe('no-store');
  });

  describe('errors', () => {
    it('422 validation_failed keeps the field names the API sent', async () => {
      const { client } = setup(422, {
        error: { code: 'validation_failed', message: 'Please check the highlighted fields.', fields: { areaId: ['Choose an area.'], street: ['Street is required.'] } },
      });
      const error = (await createAddress(client, customer, input).catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.kind).toBe('validation');
      expect(error.fieldErrors).toEqual({ areaId: ['Choose an area.'], street: ['Street is required.'] });
    });

    it('409 cannot_cancel → cannot_cancel with the backend message', async () => {
      const { client } = setup(409, { error: { code: 'cannot_cancel', message: 'This order can no longer be cancelled.' } });
      await expect(cancelOrder(client, customer, 'x', { reasonId: 1 })).rejects.toMatchObject({
        kind: 'cannot_cancel',
        code: 409,
        message: 'This order can no longer be cancelled.',
      });
    });

    it('404 on an unknown order or address, 401 without a session', async () => {
      const missing = setup(404, { error: { code: 'not_found', message: 'Not found.' } });
      await expect(getOrder(missing.client, customer, 'nope')).rejects.toMatchObject({ kind: 'not_found' });
      await expect(deleteAddress(missing.client, customer, 9)).rejects.toMatchObject({ kind: 'not_found' });

      const anonymous = setup(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } });
      await expect(getAddresses(anonymous.client, { locale: 'en', token: null })).rejects.toMatchObject({ kind: 'unauthenticated' });
    });
  });
});
