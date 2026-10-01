/**
 * The customer's loyalty points, El Dokan or iVend (contract: contract/openapi.yaml, design:
 * account-extras-v3-design.md §3). Customer token only: a guest token answers 401 `unauthenticated`.
 * 404 `not_found` while the store has no supported provider, or for a page its provider lacks
 * (`LoyaltySummary.sections`). Pages call these through src/lib, never HTTP.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { LoyaltyHistoryPage, LoyaltyRedeemed, LoyaltyReferral, LoyaltyRewardPage, LoyaltyRewards, LoyaltySummary } from './types';

const reward = (id: string) => `loyalty/rewards/${encodeURIComponent(id)}`;

/** Points, their value, the Gold level, and which loyalty pages exist (`sections`). */
export const getLoyalty = (client: StorefrontClient, ctx: ShopperContext) => client.request<LoyaltySummary>('GET', 'loyalty', ctx);

/** One page of earned, pending, used and expired points, newest first. */
export const getLoyaltyHistory = (client: StorefrontClient, ctx: ShopperContext, page = 1, perPage = 20) =>
  client.request<LoyaltyHistoryPage>('GET', 'loyalty/history', { ...ctx, query: { page: String(page), perPage: String(perPage) } });

/** The rewards, each with `canRedeem` and the `reason` when not; `blocker` = what the customer must do first. */
export const getLoyaltyRewards = (client: StorefrontClient, ctx: ShopperContext) => client.request<LoyaltyRewards>('GET', 'loyalty/rewards', ctx);

export const getLoyaltyReward = (client: StorefrontClient, ctx: ShopperContext, rewardId: string) => client.request<LoyaltyRewardPage>('GET', reward(rewardId), ctx);

/** Spends the points (only while `canRedeem`). 409 → `cannot_redeem` with the reason as the message. */
export const redeemLoyaltyReward = (client: StorefrontClient, ctx: ShopperContext, rewardId: string) =>
  client.request<LoyaltyRedeemed>('POST', `${reward(rewardId)}/redeem`, ctx);

/** The customer's referral code, how it works and a ready share text. */
export const getLoyaltyReferral = (client: StorefrontClient, ctx: ShopperContext) => client.request<LoyaltyReferral>('GET', 'loyalty/referral', ctx);
