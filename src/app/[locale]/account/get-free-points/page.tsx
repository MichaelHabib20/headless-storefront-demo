import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { LoyaltyFallback } from '@/components/loyalty/LoyaltyFallback';
import { LoyaltyNav } from '@/components/loyalty/LoyaltyNav';
import { ReferralView } from '@/components/loyalty/ReferralView';
import { translator } from '@/lib/i18n';
import { loadLoyalty, loadLoyaltyReferral, loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('loyaltyReferralTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/get-free-points: the referral code (404 while the store has referral off). */
export default async function GetFreePointsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await loyaltyOn(locale))) notFound();
  const t = translator(locale);

  const [referral, summary] = await Promise.all([loadLoyaltyReferral(locale), loadLoyalty(locale)]);
  if (referral.status === 'not-found') notFound();
  if (referral.status !== 'ok') {
    return <LoyaltyFallback locale={locale} title={t('loyaltyReferralTitle')} testId="referral-page" href={routes.freePoints(locale)} status={referral.status} />;
  }
  return (
    <AccountPage title={referral.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="referral-page">
      <LoyaltyNav locale={locale} sections={summary.status === 'ok' ? summary.data.sections : null} current="referral" />
      <ReferralView locale={locale} referral={referral.data} />
    </AccountPage>
  );
}
