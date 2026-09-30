import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { getProduct, isApiError, isLocale, type Locale, type ProductDetails } from '@/sdk';
import { ProductView } from '@/components/product/ProductView';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { positiveIntParam } from '@/components/ui/Pagination';
import { translator } from '@/lib/i18n';
import { resolveTarget } from '@/lib/routing';
import { seoMetadata } from '@/lib/seo';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';
import { notifyMeAction } from './actions';
import { RecommendationsBlock, ReviewsBlock } from './blocks';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded = { status: 'ok'; details: ProductDetails } | { status: 'not_found' } | { status: 'error' };

/**
 * The product, read once per request (metadata and page share it). With a shopper token the
 * prices and limits are the shopper's; reading never creates a guest session.
 */
const loadProduct = cache(async (locale: Locale, slug: string): Promise<Loaded> => {
  try {
    return { status: 'ok', details: await getProduct(storefrontClient(), await shopperContext(locale), slug) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not_found' };
    console.error('product failed to load', error);
    return { status: 'error' };
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const loaded = await loadProduct(locale, slug);
  if (loaded.status === 'not_found') return { title: translator(locale)('notFoundTitle'), robots: { index: false } };
  if (loaded.status !== 'ok' || loaded.details.redirect) return {};
  return seoMetadata(loaded.details.seo, locale);
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const loaded = await loadProduct(locale, slug);
  if (loaded.status === 'not_found') notFound();
  if (loaded.status === 'error') return <StoreUnavailable locale={locale} />;

  const { details } = loaded;
  // Not this product's address in this language (e.g. the English slug on /ar): go to the right one.
  const moved = resolveTarget(details.redirect, locale);
  if (moved) permanentRedirect(moved.href);

  const page = positiveIntParam((await searchParams).page, 1);
  const productSlug = details.product.slug;
  const baseHref = resolveTarget(details.product.target, locale)?.href ?? '';

  return (
    <ProductView
      details={details}
      locale={locale}
      notifyMeAction={notifyMeAction}
      recommendations={
        <Suspense fallback={null}>
          <RecommendationsBlock locale={locale} slug={productSlug} />
        </Suspense>
      }
      reviews={
        <Suspense fallback={null}>
          <ReviewsBlock locale={locale} slug={productSlug} page={page} baseHref={baseHref} />
        </Suspense>
      }
    />
  );
}
