import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCheckoutResult, isApiError, isLocale, type CheckoutResult } from '@/sdk';
import { CheckoutResultView, ResultUnknown } from '@/components/checkout/CheckoutResultView';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { purchaseEvent } from '@/lib/marketing';
import { TrackEvent } from '@/components/marketing/TrackEvent';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; id?: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('checkoutTitle') : undefined, robots: { index: false } };
}

/** The `checkout` parameter: what we put in the URL after placing, and what the bank return adds. */
function referenceFrom(value: string | string[] | undefined): string | null {
  const reference = Array.isArray(value) ? value[0] : value;
  return reference && reference.length <= 200 ? reference : null;
}

/** An order number of the old return URL (digits only; never trusted beyond opening the order page). */
function orderIdFrom(value: string | string[] | undefined): string | null {
  const id = Array.isArray(value) ? value[0] : value;
  return id && /^[1-9]\d{0,11}$/.test(id) ? id : null;
}

/**
 * Where the shopper lands after placing an order or coming back from the payment page.
 * The URL only carries a reference: what really happened is asked from the backend, and
 * nothing else in the URL (a "success" flag, an amount, a status) is ever trusted or read.
 */
export default async function CheckoutResultPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();

  const query = (await searchParams) ?? {};
  const reference = referenceFrom(query.checkout);
  const ctx = await shopperContext(locale);
  // The old storefront's address (/checkout/final-receipt[/{id}]?order_id=&is_success=), used by the
  // legacy payment returns: the order itself, on the order page, which shows only the shopper's own.
  const legacyOrder = reference ? null : orderIdFrom(id?.[0] ?? query.order_id);
  if (legacyOrder && ctx.token) redirect(routes.order(locale, legacyOrder));
  // The result belongs to the shopper who placed the order: without a session there is none to show.
  if (!reference || !ctx.token) return <ResultUnknown locale={locale} />;

  let result: CheckoutResult;
  try {
    result = await getCheckoutResult(storefrontClient(), ctx, reference);
  } catch (error) {
    if (isApiError(error) && (error.kind === 'not_found' || error.kind === 'validation' || error.kind === 'unauthenticated')) return <ResultUnknown locale={locale} />;
    console.error('checkout result failed to load', error);
    return <StoreUnavailable locale={locale} />;
  }

  return (
    <>
      <TrackEvent locale={locale} event={purchaseEvent(result)} onceKey={reference} />
      <CheckoutResultView result={result} locale={locale} />
    </>
  );
}
