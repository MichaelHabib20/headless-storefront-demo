/**
 * Address book and orders of the shopper (contract: contract/openapi.yaml). Every call needs the
 * shopper token (customer or guest). Pages call these, never HTTP.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type {
  AddressBook,
  AddressInput,
  AddressSaved,
  CancelOrderInput,
  CancellationReasons,
  Order,
  OrdersPage,
  ReorderResult,
} from './types';

interface PageQuery {
  page?: number;
  perPage?: number;
}

const order = (orderId: string) => `orders/${encodeURIComponent(orderId)}`;

// address book
export const getAddresses = (client: StorefrontClient, ctx: ShopperContext) => client.request<AddressBook>('GET', 'addresses', ctx);

/** Answers the new address AND the whole address book. */
export const createAddress = (client: StorefrontClient, ctx: ShopperContext, input: AddressInput) =>
  client.request<AddressSaved>('POST', 'addresses', { ...ctx, body: input });

/** The answer's `address.id` is the id to use from now on: the backend may give the edited address a new id. */
export const updateAddress = (client: StorefrontClient, ctx: ShopperContext, addressId: number, input: AddressInput) =>
  client.request<AddressSaved>('PUT', `addresses/${addressId}`, { ...ctx, body: input });

export const deleteAddress = (client: StorefrontClient, ctx: ShopperContext, addressId: number) =>
  client.request<AddressBook>('DELETE', `addresses/${addressId}`, ctx);

export const setDefaultAddress = (client: StorefrontClient, ctx: ShopperContext, addressId: number) =>
  client.request<AddressBook>('POST', `addresses/${addressId}/default`, ctx);

// orders
export const getOrders = (client: StorefrontClient, ctx: ShopperContext, { page, perPage }: PageQuery = {}) =>
  client.request<OrdersPage>('GET', 'orders', { ...ctx, query: { page, perPage } });

/** Read-only. `orderId` is `OrderSummary.id` (a string, not the order number). */
export const getOrder = (client: StorefrontClient, ctx: ShopperContext, orderId: string) => client.request<Order>('GET', order(orderId), ctx);

export const getOrderCancellationReasons = (client: StorefrontClient, ctx: ShopperContext) =>
  client.request<CancellationReasons>('GET', 'orders/cancellation-reasons', ctx);

/** Only while `actions.canCancel`; otherwise the backend answers 409 `cannot_cancel`. Answers the order after the change. */
export const cancelOrder = (client: StorefrontClient, ctx: ShopperContext, orderId: string, { reasonId, note }: CancelOrderInput) =>
  client.request<Order>('POST', `${order(orderId)}/cancel`, { ...ctx, body: { reasonId, note: note ?? null } });

/** Puts the order's items in the cart again; answers the cart and the items that were skipped. */
export const reorder = (client: StorefrontClient, ctx: ShopperContext, orderId: string) =>
  client.request<ReorderResult>('POST', `${order(orderId)}/reorder`, ctx);
