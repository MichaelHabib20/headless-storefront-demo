/**
 * The customer's refund bank details (contract: contract/openapi.yaml, design: phase-b-v3-design.md §5).
 * Customer token only. 404 `not_found` while the store has it off (`Layout.features.bankDetails`).
 * Refusals → 422 `validation` with the reason per field in `fieldErrors`.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { BankDetails, BankDetailsInput, BankDetailsSaved } from './types';

/** The form (its fields follow the store's settings) and what is on record, masked. */
export const getBankDetails = (client: StorefrontClient, ctx: ShopperContext) => client.request<BankDetails>('GET', 'account/bank-details', ctx);

/** Replaces the details: every field the form shows (a field not sent is cleared). */
export const saveBankDetails = (client: StorefrontClient, ctx: ShopperContext, input: BankDetailsInput) =>
  client.request<BankDetailsSaved>('PUT', 'account/bank-details', { ...ctx, body: input });
