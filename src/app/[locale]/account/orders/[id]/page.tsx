import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { AccountLoadError, AccountSignIn } from '@/components/account/AccountStates';
import { AccountPage } from '@/components/account/AccountPage';
import { OrderDetails } from '@/components/account/OrderDetails';
import { loadCancellationReasons, loadOrder } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { writeReviewAction } from '@/lib/reviews.actions';
import { cancelOrderAction, rateOrderAction, reorderAction } from '../actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id: string }>;

/** The order id from the URL (`routes.order` encodes it). */
function orderIdOf(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, id } = await params;
  if (!isLocale(locale)) return {};
  const t = translator(locale);
  const result = await loadOrder(locale, orderIdOf(id));
  return { title: result.status === 'ok' ? t('orderNumber').replace('{number}', result.data.number) : t('ordersTitle'), robots: { index: false } };
}

/** One order of the shopper. Read-only: cancelling and ordering again are server actions after a click. */
export default async function OrderPage({ params }: { params: Params }) {
  const { locale, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  const id = orderIdOf(rawId);
  const t = translator(locale);

  const result = await loadOrder(locale, id);
  if (result.status === 'not-found') notFound();
  if (result.status !== 'ok') {
    return (
      <AccountPage title={t('ordersTitle')} back={{ href: routes.orders(locale), label: t('orderBack') }}>
        {result.status === 'signed-out' ? (
          <AccountSignIn locale={locale} returnTo={routes.order(locale, id)} />
        ) : (
          <AccountLoadError locale={locale} retryHref={routes.order(locale, id)} />
        )}
      </AccountPage>
    );
  }

  const order = result.data;
  // The reasons are only needed when the API allows cancelling.
  const reasons = order.actions.canCancel ? await loadCancellationReasons(locale) : null;

  return (
    <OrderDetails
      order={order}
      locale={locale}
      reasons={reasons}
      cancelAction={cancelOrderAction}
      reorderAction={reorderAction}
      rateAction={rateOrderAction}
      writeReviewAction={writeReviewAction}
    />
  );
}
