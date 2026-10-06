/**
 * The customer's insurance profiles (contract: contract/openapi.yaml, design: phase-b-v3-design.md §4).
 * Customer token only: a guest token answers 401 `unauthenticated`. 404 `not_found` while the store takes
 * no insurance prescriptions (`Layout.features.insurance`), and for a profile that is not the customer's.
 * Refusals → 422 `validation` with the reason per field (the v3 names) in `fieldErrors`.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { InsuranceDeleted, InsurancePage, InsuranceProfileInput, InsuranceSaved } from './types';

const profile = (id: string) => `insurance/profiles/${encodeURIComponent(id)}`;

/** The profiles, and the form to add one (its fields follow the store's settings). */
export const getInsurance = (client: StorefrontClient, ctx: ShopperContext) => client.request<InsurancePage>('GET', 'insurance', ctx);

export const addInsuranceProfile = (client: StorefrontClient, ctx: ShopperContext, input: InsuranceProfileInput) =>
  client.request<InsuranceSaved>('POST', 'insurance/profiles', { ...ctx, body: input });

/** Photos not sent again stay as they are. */
export const updateInsuranceProfile = (client: StorefrontClient, ctx: ShopperContext, id: string, input: InsuranceProfileInput) =>
  client.request<InsuranceSaved>('PUT', profile(id), { ...ctx, body: input });

export const deleteInsuranceProfile = (client: StorefrontClient, ctx: ShopperContext, id: string) => client.request<InsuranceDeleted>('DELETE', profile(id), ctx);
