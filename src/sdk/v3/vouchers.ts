/**
 * The customer's vouchers, cashback vouchers included (contract: contract/openapi.yaml, design:
 * phase-b-v3-design.md §2). Customer token only: a guest token answers 401 `unauthenticated`. 404
 * `not_found` while the store has vouchers and cashback off (`Layout.features.vouchers`). Using a
 * voucher is the checkout's promo code, not a call here.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { VoucherAdded, Vouchers } from './types';

/** Every voucher with one status, the tabs (`statuses`) and whether the add form is shown. */
export const getVouchers = (client: StorefrontClient, ctx: ShopperContext) => client.request<Vouchers>('GET', 'vouchers', ctx);

/** Adds a code. Refused → 422 `validation` with the backend's reason in `fields.code`. */
export const addVoucher = (client: StorefrontClient, ctx: ShopperContext, code: string) =>
  client.request<VoucherAdded>('POST', 'vouchers', { ...ctx, body: { code } });
