import type { Locale, LoyaltyReward } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './Loyalty.module.css';

/** A reward as the backend describes it: what it gives, what it costs, and why not when it can't be redeemed. */
export function RewardCard({ locale, reward, detailed = false }: { locale: Locale; reward: LoyaltyReward; detailed?: boolean }) {
  const t = translator(locale);
  return (
    <div className={styles.reward} data-testid="reward" data-id={reward.id} data-kind={reward.kind} data-can-redeem={reward.canRedeem}>
      {reward.image && (
        // eslint-disable-next-line @next/next/no-img-element -- merchant image from any CDN
        <img src={reward.image} alt="" className={styles.rewardImage} loading="lazy" />
      )}
      <div className={styles.rewardBody}>
        {reward.badge && <span className={styles.badge}>{reward.badge}</span>}
        {detailed ? <h2 className={styles.rewardName}>{reward.name}</h2> : <h3 className={styles.rewardName}>{reward.name}</h3>}
        {reward.benefit && <p className={styles.benefit}>{reward.benefit}</p>}
        {detailed && reward.description && <p className={styles.muted}>{reward.description}</p>}
        <p className={styles.cost}>
          <span className={styles.label}>{t('loyaltyCost')}</span> <strong data-testid="reward-cost">{reward.cost.text}</strong>
        </p>
        {reward.reason && (
          <p className={styles.reason} data-testid="reward-reason">
            {reward.reason}
          </p>
        )}
      </div>
    </div>
  );
}
