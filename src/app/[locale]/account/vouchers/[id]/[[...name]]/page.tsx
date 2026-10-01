import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { LoyaltyBlockerNotice } from '@/components/loyalty/LoyaltyBlockerNotice';
import { LoyaltyFallback } from '@/components/loyalty/LoyaltyFallback';
import { RedeemReward } from '@/components/loyalty/RedeemReward';
import { RewardCard } from '@/components/loyalty/RewardCard';
import styles from '@/components/loyalty/Loyalty.module.css';
import { translator } from '@/lib/i18n';
import { loadLoyaltyReward, loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';
import { redeemRewardAction } from '../../actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string; name?: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('loyaltyRewardsTitle') : undefined, robots: { index: false } };
}

/**
 * The old storefront's /account/vouchers/:id(/:name): one reward and "Redeem" when the backend allows
 * it. The name segment of old links is ignored (the id decides).
 */
export default async function RewardPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^\d{1,20}$/.test(id)) notFound();
  if (!(await loyaltyOn(locale))) notFound();
  const t = translator(locale);

  const page = await loadLoyaltyReward(locale, id);
  if (page.status === 'not-found') notFound();
  if (page.status !== 'ok') {
    return <LoyaltyFallback locale={locale} title={t('loyaltyRewardsTitle')} testId="reward-page" href={routes.reward(locale, id)} status={page.status} />;
  }
  const { reward, points, blocker } = page.data;
  return (
    <AccountPage title={reward.name} back={{ href: routes.rewards(locale), label: t('loyaltyBackToRewards') }} testId="reward-page">
      <div className={styles.stack}>
        <p className={styles.balanceLine}>
          <span className={styles.label}>{t('loyaltyBalance')}</span> <strong data-testid="loyalty-points">{points.text}</strong>
        </p>
        <LoyaltyBlockerNotice locale={locale} blocker={blocker} />
        <RewardCard locale={locale} reward={reward} detailed />
        <RedeemReward locale={locale} rewardId={reward.id} canRedeem={reward.canRedeem} redeemAction={redeemRewardAction} />
      </div>
    </AccountPage>
  );
}
