import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { LoyaltyFallback } from '@/components/loyalty/LoyaltyFallback';
import { LoyaltyNav } from '@/components/loyalty/LoyaltyNav';
import { PointsHistory } from '@/components/loyalty/PointsHistory';
import { translator } from '@/lib/i18n';
import { loadLoyalty, loadLoyaltyHistory, loyaltyOn } from '@/lib/loyalty.server';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pageOf(params: Record<string, string | string[] | undefined>): number {
  const raw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('loyaltyHistoryTitle') : undefined, robots: { index: false } };
}

/** The old storefront's /account/history: points earned, pending, used and expired (El Dokan; 404 otherwise). */
export default async function PointsHistoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await loyaltyOn(locale))) notFound();
  const t = translator(locale);
  const page = pageOf(await searchParams);

  const [history, summary] = await Promise.all([loadLoyaltyHistory(locale, page), loadLoyalty(locale)]);
  if (history.status === 'not-found') notFound();
  if (history.status !== 'ok') {
    return <LoyaltyFallback locale={locale} title={t('loyaltyHistoryTitle')} testId="history-page" href={routes.pointsHistory(locale, page)} status={history.status} />;
  }
  return (
    <AccountPage title={t('loyaltyHistoryTitle')} back={{ href: routes.account(locale), label: t('account') }} testId="history-page">
      <LoyaltyNav locale={locale} sections={summary.status === 'ok' ? summary.data.sections : null} current="history" />
      <PointsHistory locale={locale} page={history.data} />
    </AccountPage>
  );
}
