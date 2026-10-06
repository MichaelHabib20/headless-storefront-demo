/**
 * The customer's wallet (contract: contract/openapi.yaml, design: phase-b-v3-design.md §1). Customer
 * token only: a guest token answers 401 `unauthenticated`. 404 `not_found` while the store has the
 * wallet off (`Layout.features.wallet`). Paying with it is a checkout choice (`useWallet`), not a call here.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { Wallet } from './types';

/** The balance and one page of its history, newest first. */
export const getWallet = (client: StorefrontClient, ctx: ShopperContext, page = 1, perPage = 20) =>
  client.request<Wallet>('GET', 'wallet', { ...ctx, query: { page: String(page), perPage: String(perPage) } });
