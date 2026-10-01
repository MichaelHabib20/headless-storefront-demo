import Link from 'next/link';
import type { Locale, LoyaltyRewards } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { LoyaltyBlockerNotice } from './LoyaltyBlockerNotice';
import { RewardCard } from './RewardCard';
import styles from './Loyalty.module.css';

/** The rewards (the old /account/vouchers), each linking to its page where it is redeemed. */
export function RewardsList({ locale, rewards }: { locale: Locale; rewards: LoyaltyRewards }) {
  const t = translator(locale);
  return (
    <div className={styles.stack}>
      <p className={styles.balanceLine}>
        <span className={styles.label}>{t('loyaltyBalance')}</span> <strong data-testid="loyalty-points">{rewards.points.text}</strong>
      </p>
      <LoyaltyBlockerNotice locale={locale} blocker={rewards.blocker} />
      {rewards.items.length === 0 ? (
        <p className={styles.muted} data-testid="rewards-empty">
          {t('loyaltyRewardsEmpty')}
        </p>
      ) : (
        <ul className={styles.rewards} data-testid="rewards">
          {rewards.items.map((reward) => (
            <li key={reward.id}>
              <RewardCard locale={locale} reward={reward} />
              <Link href={routes.reward(locale, reward.id)} className={styles.link} aria-label={`${t('loyaltyRewardDetails')}: ${reward.name}`}>
                {t('loyaltyRewardDetails')}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
