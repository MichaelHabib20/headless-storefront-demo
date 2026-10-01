import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/sdk';
import { AccountPage } from '@/components/account/AccountPage';
import { AccountLoadError } from '@/components/account/AccountStates';
import { OrderDetails } from '@/components/account/OrderDetails';
import { TrackOrderForm } from '@/components/account/TrackOrderForm';
import { loadTrackedOrder } from '@/lib/account.server';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { loadLayout } from '@/lib/storefront.server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MAX_NUMBER = 32;
const MAX_PHONE = 32;

/** The typed values from the URL (the form submits with GET so the page is a plain read). */
function typed(params: Record<string, string | string[] | undefined>): { number: string; phone: string } | null {
  const number = String(Array.isArray(params.number) ? params.number[0] : (params.number ?? '')).trim();
  const phone = String(Array.isArray(params.phone) ? params.phone[0] : (params.phone ?? '')).trim();
  if (!number || !phone || number.length > MAX_NUMBER || phone.length > MAX_PHONE) return null;
  return { number, phone };
}

/** The page exists only while the store has order tracking on (`Layout.features.orderTracking`). */
async function trackingEnabled(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.orderTracking);
  } catch {
    return false;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: translator(locale)('trackTitle'), robots: { index: false } };
}

/**
 * Track an order without signing in: order number + the phone it was placed with. The backend
 * answers the order only when both match (and never says which one was wrong). Read-only: no
 * session is created, no action is offered on the order shown.
 */
export default async function TrackOrderPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  if (!(await trackingEnabled(locale))) notFound();
  const t = translator(locale);
  const query = typed(await searchParams);
  const result = query ? await loadTrackedOrder(locale, query.number, query.phone) : null;

  return (
    <AccountPage title={t('trackTitle')} testId="track-order">
      <TrackOrderForm locale={locale} values={query} notFound={result?.status === 'not-found'} />
      {result?.status === 'error' && <AccountLoadError locale={locale} retryHref={routes.trackOrder(locale)} />}
      {result?.status === 'ok' && <OrderDetails order={result.data} locale={locale} />}
    </AccountPage>
  );
}
