import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { getProduct, isApiError, isLocale, type Locale, type ProductDetails } from '@/sdk';
import { ProductView } from '@/components/product/ProductView';
import { ShareButton } from '@/components/product/ShareButton';
import { StoreUnavailable } from '@/components/layout/StoreUnavailable';
import { positiveIntParam } from '@/components/ui/Pagination';
import { translator } from '@/lib/i18n';
import { resolveTarget } from '@/lib/routing';
import { seoMetadata } from '@/lib/seo';
import { JsonLd } from '@/lib/jsonld';
import { viewItemEvent } from '@/lib/marketing';
import { TrackEvent } from '@/components/marketing/TrackEvent';
import { shopperContext } from '@/lib/shopper.server';
import { loadLayout, storefrontClient } from '@/lib/storefront.server';
import { answerPath } from '@/lib/resolve.server';
import { notifyMeAction } from './actions';
import { RecommendationsBlock, ReviewsBlock } from './blocks';

/**
 * The product page, at the old storefront's address `/{locale}/{slug}` (a single segment at the root;
 * rendered by the catch-all route, src/app/[locale]/[...slug]/page.tsx).
 */
type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type Loaded = { status: 'ok'; details: ProductDetails } | { status: 'not_found' } | { status: 'error' };

/**
 * The slug as the backend wrote it. Next hands dynamic segments over percent-encoded
 * (`%D8%A7…` for an Arabic slug); the SDK encodes the slug itself.
 */
function slugParam(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

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
  const loaded = await loadProduct(locale, slugParam(slug));
  if (loaded.status === 'not_found') return { title: translator(locale)('notFoundTitle'), robots: { index: false } };
  if (loaded.status !== 'ok' || loaded.details.redirect) return {};
  return seoMetadata(loaded.details.seo, locale);
}

export default async function ProductPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const loaded = await loadProduct(locale, slugParam(slug));
  if (loaded.status === 'not_found') await notAProduct(locale, slug, await searchParams);
  if (loaded.status !== 'ok') return <StoreUnavailable locale={locale} />;

  const { details } = loaded;
  // Not this product's address in this language (e.g. the English slug on /ar): go to the right one.
  const moved = resolveTarget(details.redirect, locale);
  if (moved) permanentRedirect(moved.href);

  const page = positiveIntParam((await searchParams).page, 1);
  const productSlug = details.product.slug;
  const baseHref = resolveTarget(details.product.target, locale)?.href ?? '';
  const share = await shareEnabled(locale);

  return (
    <>
    <JsonLd seo={details.seo} locale={locale} />
    <TrackEvent locale={locale} event={viewItemEvent(details)} />
    <ProductView
      details={details}
      locale={locale}
      notifyMeAction={notifyMeAction}
      share={share ? <ShareButton locale={locale} title={details.product.name} /> : null}
      recommendations={
        <Suspense fallback={null}>
          <RecommendationsBlock locale={locale} slug={productSlug} />
        </Suspense>
      }
      reviews={
        <Suspense fallback={null}>
          <ReviewsBlock locale={locale} slug={productSlug} page={page} baseHref={baseHref} productId={details.product.id} productName={details.product.name} />
        </Suspense>
      }
    />
    </>
  );
}

/**
 * A root slug that is no product: the old storefront's other one-segment URLs (a category, a CMS page
 * or a brand by its slug) move to their page; anything else is a 404. Never returns.
 */
async function notAProduct(locale: Locale, slug: string, query: Record<string, string | string[] | undefined>): Promise<never> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, item);
  }
  const requested = new URL(`/${locale}/${slug}${search.size ? `?${search}` : ''}`, 'http://storefront.local');
  const answer = await answerPath(locale, requested);
  if (answer?.kind === 'redirect') {
    if (answer.status === 301) permanentRedirect(answer.location);
    redirect(answer.location);
  }
  notFound();
}

/** `Layout.features.share` (the layout is read once per request); a failing layout hides the button. */
async function shareEnabled(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.share);
  } catch {
    return false;
  }
}
