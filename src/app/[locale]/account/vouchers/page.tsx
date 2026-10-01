import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { LoyaltyFallback } from '@/components/loyalty/LoyaltyFallback';
import { LoyaltyNav } from '@/components/loyalty/LoyaltyNav';
import { RewardsList } from '@/components/loyalty/RewardsList';
import { translator } from '@/lib/i18n';
import { loadLoyalty, loadLoyaltyRewards, loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('loyaltyRewardsTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/vouchers: the rewards points buy (El Dokan; 404 for a provider without rewards). */
export default async function RewardsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await loyaltyOn(locale))) notFound();
  const t = translator(locale);

  const [rewards, summary] = await Promise.all([loadLoyaltyRewards(locale), loadLoyalty(locale)]);
  if (rewards.status === 'not-found') notFound();
  if (rewards.status !== 'ok') {
    return <LoyaltyFallback locale={locale} title={t('loyaltyRewardsTitle')} testId="rewards-page" href={routes.rewards(locale)} status={rewards.status} />;
  }
  return (
    <AccountPage title={t('loyaltyRewardsTitle')} back={{ href: routes.account(locale), label: t('account') }} testId="rewards-page">
      <LoyaltyNav locale={locale} sections={summary.status === 'ok' ? summary.data.sections : null} current="rewards" />
      <RewardsList locale={locale} rewards={rewards.data} />
    </AccountPage>
  );
}
