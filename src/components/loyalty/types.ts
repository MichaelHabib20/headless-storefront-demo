import type { Locale, LoyaltyPoints, LoyaltyRedemption } from '@/sdk';

/** What redeeming answers to the page: the backend's redemption, or its reason for refusing. */
export type RedeemResult = { ok: true; redemption: LoyaltyRedemption; points: LoyaltyPoints } | { ok: false; message: string };

export type RedeemAction = (locale: Locale, rewardId: string) => Promise<RedeemResult>;
