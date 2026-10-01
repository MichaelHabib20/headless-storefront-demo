import 'server-only';
import {
  getLoyalty,
  getLoyaltyHistory,
  getLoyaltyReferral,
  getLoyaltyReward,
  getLoyaltyRewards,
  isApiError,
  type Locale,
  type LoyaltyHistoryPage,
  type LoyaltyReferral,
  type LoyaltyRewardPage,
  type LoyaltyRewards,
  type LoyaltySummary,
} from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

/** History entries on one page. */
export const POINTS_HISTORY_PER_PAGE = 20;

/** The loyalty pages exist only while the store has a loyalty provider v3 supports (`Layout.features.loyalty`). */
export async function loyaltyOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.loyalty);
  } catch {
    return false;
  }
}

/**
 * Reads of the loyalty pages. Customer only: without the customer's token (a guest token is not
 * enough) → `signed-out`, never a guest session. `not-found` = no loyalty, or a page the store's
 * provider does not have (the backend decides).
 */
async function customerRead<T>(call: (token: string) => Promise<T>): Promise<AccountResult<T>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await call(token) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('loyalty failed to load', error);
    return { status: 'error' };
  }
}

export function loadLoyalty(locale: Locale): Promise<AccountResult<LoyaltySummary>> {
  return customerRead((token) => getLoyalty(storefrontClient(), { locale, token }));
}

export function loadLoyaltyRewards(locale: Locale): Promise<AccountResult<LoyaltyRewards>> {
  return customerRead((token) => getLoyaltyRewards(storefrontClient(), { locale, token }));
}

export function loadLoyaltyReward(locale: Locale, id: string): Promise<AccountResult<LoyaltyRewardPage>> {
  return customerRead((token) => getLoyaltyReward(storefrontClient(), { locale, token }, id));
}

export function loadLoyaltyHistory(locale: Locale, page: number): Promise<AccountResult<LoyaltyHistoryPage>> {
  return customerRead((token) => getLoyaltyHistory(storefrontClient(), { locale, token }, page, POINTS_HISTORY_PER_PAGE));
}

export function loadLoyaltyReferral(locale: Locale): Promise<AccountResult<LoyaltyReferral>> {
  return customerRead((token) => getLoyaltyReferral(storefrontClient(), { locale, token }));
}
