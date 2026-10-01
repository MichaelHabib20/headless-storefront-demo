'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { Locale } from '@/sdk';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { CopyButton } from './CopyButton';
import type { RedeemAction, RedeemResult } from './types';
import styles from './Loyalty.module.css';

interface RedeemRewardProps {
  locale: Locale;
  rewardId: string;
  /** `LoyaltyReward.canRedeem`: the backend decided; the button is only drawn when true. */
  canRedeem: boolean;
  redeemAction: RedeemAction;
  timeZone?: string;
}

/** "Redeem" (only where the backend allows it), then the voucher code or the backend's reason. */
export function RedeemReward({ locale, rewardId, canRedeem, redeemAction, timeZone }: RedeemRewardProps) {
  const t = translator(locale);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RedeemResult | null>(null);

  if (result?.ok) {
    const { redemption, points } = result;
    return (
      <div className={styles.redeemed} role="status" data-testid="redemption" data-kind={redemption.kind}>
        <p>{redemption.message}</p>
        {redemption.code && (
          <p className={styles.code}>
            <span className={styles.label}>{t('loyaltyYourCode')}</span> <strong data-testid="redemption-code">{redemption.code}</strong>{' '}
            <CopyButton locale={locale} text={redemption.code} />
          </p>
        )}
        {redemption.expiresAt && <p className={styles.muted}>{t('loyaltyExpires').replace('{date}', formatDate(redemption.expiresAt, locale, { timeZone }))}</p>}
        <p className={styles.muted} data-testid="redemption-points">
          {t('loyaltyPointsLeft').replace('{points}', points.text)}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      {canRedeem && (
        <button
          type="button"
          className={styles.primary}
          disabled={pending}
          data-testid="redeem"
          onClick={() =>
            startTransition(async () => {
              const answer = await redeemAction(locale, rewardId);
              setResult(answer);
              router.refresh();
            })
          }
        >
          {pending ? t('loyaltyRedeeming') : t('loyaltyRedeem')}
        </button>
      )}
      {result && !result.ok && (
        <p className={styles.error} role="alert" data-testid="redeem-error">
          {result.message}
        </p>
      )}
    </div>
  );
}
