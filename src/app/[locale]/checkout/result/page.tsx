import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCheckoutResult, isApiError, isLocale, type CheckoutResult } from '@/sdk';
import { CheckoutResultView, ResultUnknown } from '@/components/checkout/CheckoutResultView';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
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

/**
 * Where the shopper lands after placing an order or coming back from the payment page.
 * The URL only carries a reference: what really happened is asked from the backend, and
 * nothing else in the URL (a "success" flag, an amount, a status) is ever trusted or read.
 */
export default async function CheckoutResultPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const reference = referenceFrom(((await searchParams) ?? {}).checkout);
  const ctx = await shopperContext(locale);
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

  return <CheckoutResultView result={result} locale={locale} />;
}
