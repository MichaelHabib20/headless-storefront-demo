import type { Locale, LoyaltyReferral } from '@/sdk';
import { CopyButton } from './CopyButton';
import styles from './Loyalty.module.css';

/** The customer's referral code and how it works (the old /account/get-free-points). */
export function ReferralView({ locale, referral }: { locale: Locale; referral: LoyaltyReferral }) {
  return (
    <section className={styles.card} data-testid="referral">
      <p data-testid="referral-message">{referral.message}</p>
      {referral.code && (
        <p className={styles.code}>
          <strong className={styles.referralCode} data-testid="referral-code">
            {referral.code}
          </strong>{' '}
          <CopyButton locale={locale} text={referral.code} />
          {referral.shareText && <CopyButton locale={locale} text={referral.shareText} label="loyaltyCopyInvite" />}
        </p>
      )}
    </section>
  );
}
