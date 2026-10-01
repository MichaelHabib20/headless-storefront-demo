import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { LoyaltyFallback } from '@/components/loyalty/LoyaltyFallback';
import { LoyaltyNav } from '@/components/loyalty/LoyaltyNav';
import { LoyaltySummaryView } from '@/components/loyalty/LoyaltySummaryView';
import { translator } from '@/lib/i18n';
import { loadLoyalty, loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('loyaltyPointsTitle') : undefined, robots: { index: false } };
}

/**
 * The old storefront's /account/your-points: the customer's points (El Dokan or iVend) as the
 * backend wrote them, and links to the loyalty pages the store's provider has. Customers only.
 */
export default async function YourPointsPage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await loyaltyOn(locale))) notFound();
  const t = translator(locale);

  const summary = await loadLoyalty(locale);
  if (summary.status === 'not-found') notFound();
  if (summary.status !== 'ok') {
    return <LoyaltyFallback locale={locale} title={t('loyaltyPointsTitle')} testId="points-page" href={routes.points(locale)} status={summary.status} />;
  }
  return (
    <AccountPage title={summary.data.title} back={{ href: routes.account(locale), label: t('account') }} testId="points-page">
      <LoyaltyNav locale={locale} sections={summary.data.sections} current="points" />
      <LoyaltySummaryView locale={locale} summary={summary.data} />
    </AccountPage>
  );
}
