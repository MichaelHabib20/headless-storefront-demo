'use server';

import { revalidatePath } from 'next/cache';
import { isApiError, isLocale, redeemLoyaltyReward, type Locale } from '@/sdk';
import type { RedeemResult } from '@/components/loyalty/types';
import { translator } from '@/lib/i18n';
import { customerToken } from '@/lib/session';
import { storefrontClient } from '@/lib/storefront.server';

/** Errors whose message is the SDK's own (English only): replaced by ours. */
const LOCAL_ERRORS: ReadonlySet<string> = new Set(['network', 'invalid_response', 'unknown', 'server']);

/**
 * Redeems a reward (POST /loyalty/rewards/{id}/redeem) with the customer's token. The backend decides
 * whether it can be redeemed and says why not (`cannot_redeem`); its answer is shown as it is.
 */
export async function redeemRewardAction(rawLocale: Locale, rewardId: string): Promise<RedeemResult> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'en';
  const t = translator(locale);
  const token = await customerToken();
  if (!token) return { ok: false, message: t('loyaltySignIn') };
  try {
    const redeemed = await redeemLoyaltyReward(storefrontClient(), { locale, token }, rewardId);
    revalidatePath('/[locale]/account', 'layout');
    return { ok: true, redemption: redeemed.redemption, points: redeemed.points };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { ok: false, message: t('loyaltySignIn') };
    if (isApiError(error) && !LOCAL_ERRORS.has(error.kind)) return { ok: false, message: error.message };
    console.error('loyalty redeem failed', error);
    return { ok: false, message: t('loyaltyRedeemFailed') };
  }
}
