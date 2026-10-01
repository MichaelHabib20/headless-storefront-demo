/**
 * Loyalty answers used by tests, generated from the contract-checked mock
 * (`node scripts/build-loyalty-fixtures.mjs`; `npm run contract:check` validates them).
 */
import type { Locale, LoyaltyHistoryPage, LoyaltyRedeemed, LoyaltyReferral, LoyaltyRewardPage, LoyaltyRewards, LoyaltySummary } from '@/sdk';
import historyAr from './fixtures/v3/loyalty-history.ar.json';
import historyEn from './fixtures/v3/loyalty-history.en.json';
import redeemedAr from './fixtures/v3/loyalty-redeemed.ar.json';
import redeemedEn from './fixtures/v3/loyalty-redeemed.en.json';
import referralAr from './fixtures/v3/loyalty-referral.ar.json';
import referralEn from './fixtures/v3/loyalty-referral.en.json';
import rewardAr from './fixtures/v3/loyalty-reward.ar.json';
import rewardEn from './fixtures/v3/loyalty-reward.en.json';
import blockedAr from './fixtures/v3/loyalty-rewards-blocked.ar.json';
import blockedEn from './fixtures/v3/loyalty-rewards-blocked.en.json';
import rewardsAr from './fixtures/v3/loyalty-rewards.ar.json';
import rewardsEn from './fixtures/v3/loyalty-rewards.en.json';
import ivendAr from './fixtures/v3/loyalty-summary-ivend.ar.json';
import ivendEn from './fixtures/v3/loyalty-summary-ivend.en.json';
import summaryAr from './fixtures/v3/loyalty-summary.ar.json';
import summaryEn from './fixtures/v3/loyalty-summary.en.json';

const pick = <T>(locale: Locale, ar: { data: unknown }, en: { data: unknown }) => structuredClone((locale === 'ar' ? ar : en).data) as T;

/** El Dokan: 1,000 points, not Gold, 80 pending, 300 expiring; rewards, history and referral on. */
export const loyaltySummaryFixture = (locale: Locale = 'en') => pick<LoyaltySummary>(locale, summaryAr, summaryEn);
/** iVend: points, their value and store credit; no other loyalty page. */
export const ivendSummaryFixture = (locale: Locale = 'en') => pick<LoyaltySummary>(locale, ivendAr, ivendEn);
/** #3 and #4 redeemable, #5 Gold only, #6 needs 1,000 more points. */
export const loyaltyRewardsFixture = (locale: Locale = 'en') => pick<LoyaltyRewards>(locale, rewardsAr, rewardsEn);
/** The same with the phone not verified: blocker `verify_phone`, nothing redeemable. */
export const blockedRewardsFixture = (locale: Locale = 'en') => pick<LoyaltyRewards>(locale, blockedAr, blockedEn);
/** Reward #3 (a 50 EGP voucher, 500 points), redeemable. */
export const loyaltyRewardFixture = (locale: Locale = 'en') => pick<LoyaltyRewardPage>(locale, rewardAr, rewardEn);
/** Reward #3 redeemed: its code, and 500 points left. */
export const loyaltyRedeemedFixture = (locale: Locale = 'en') => pick<LoyaltyRedeemed>(locale, redeemedAr, redeemedEn);
/** Pending, used, referral, earned (with an order), expired: newest first. */
export const loyaltyHistoryFixture = (locale: Locale = 'en') => pick<LoyaltyHistoryPage>(locale, historyAr, historyEn);
/** Code MONA50 and its invite text. */
export const loyaltyReferralFixture = (locale: Locale = 'en') => pick<LoyaltyReferral>(locale, referralAr, referralEn);
