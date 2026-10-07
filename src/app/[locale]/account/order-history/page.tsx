import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { OrdersList } from '@/components/account/OrdersList';
import { pageHref, positiveIntParam } from '@/components/ui/Pagination';
import { loadOrders } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

const PER_PAGE = 10;

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('ordersTitle') : undefined, robots: { index: false } };
}

/** The shopper's orders, newest first as the API lists them, 10 per page. Reads only. */
export default async function OrdersPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const page = positiveIntParam((await searchParams).page, 1);
  const t = translator(locale);
  const here = pageHref(routes.orders(locale), page);

  const result = await loadOrders(locale, page, PER_PAGE);

  // Past the last page (an old link): go to the last one.
  if (result.status === 'ok' && !result.data.items.length && page > 1 && result.data.pagination.totalPages >= 1) {
    redirect(pageHref(routes.orders(locale), result.data.pagination.totalPages));
  }

  return (
    <AccountPage title={t('ordersTitle')} testId="orders-page">
      {result.status === 'ok' ? (
        <OrdersList orders={result.data} locale={locale} />
      ) : result.status === 'signed-out' ? (
        <AccountSignIn locale={locale} returnTo={here} />
      ) : (
        <AccountLoadError locale={locale} retryHref={here} />
      )}
    </AccountPage>
  );
}
