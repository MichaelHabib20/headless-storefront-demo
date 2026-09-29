import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCompare, isApiError, isLocale, type Locale } from '@/sdk';
import { CompareView, type CompareState } from '@/components/compare/CompareView';
import { translator } from '@/lib/i18n';
import { shopperContext } from '@/lib/shopper.server';
import { loadLayout, storefrontClient } from '@/lib/storefront.server';
import { removeFromCompareAction } from './actions';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('compareTitle') : undefined, robots: { index: false } };
}

/** The store can switch compare off; then the page doesn't exist. */
async function compareEnabled(locale: Locale): Promise<boolean> {
  try {
    return (await loadLayout(locale)).features.compare;
  } catch {
    return true; // the layout shows "store unavailable" on its own
  }
}

async function loadCompare(locale: Locale): Promise<CompareState> {
  // Rendering never creates a guest: without a token there is nothing to compare yet.
  const ctx = await shopperContext(locale);
  if (!ctx.token) return { status: 'guest' };
  try {
    return { status: 'ok', compare: await getCompare(storefrontClient(), ctx) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'guest' };
    console.error('compare failed to load', error);
    return { status: 'error' };
  }
}

export default async function ComparePage({ params }: { params: Params }) {
  const { locale } = await params;
  if (!isLocale(locale) || !(await compareEnabled(locale))) notFound();

  return <CompareView state={await loadCompare(locale)} locale={locale} onRemove={removeFromCompareAction} />;
}
