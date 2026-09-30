import 'server-only';
import { getProductRecommendations, getProductReviews, type Locale } from '@/sdk';
import { ProductRecommendations } from '@/components/product/ProductRecommendations';
import { ProductReviews, ProductReviewsUnavailable } from '@/components/product/ProductReviews';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

/** Reviews per page on the product page (the contract allows 1–50). */
export const REVIEWS_PER_PAGE = 5;

/*
 * The parts of the product page that load on their own, inside <Suspense>: the product shows
 * first, and a failure here never breaks the page.
 */

/** Recommendation rows; nothing when they cannot be loaded. With a token, prices are the shopper's. */
export async function RecommendationsBlock({ locale, slug }: { locale: Locale; slug: string }) {
  try {
    const { sections } = await getProductRecommendations(storefrontClient(), await shopperContext(locale), slug);
    return <ProductRecommendations sections={sections} locale={locale} />;
  } catch (error) {
    console.error('product recommendations failed to load', error);
    return null;
  }
}

/** One page of reviews (public); a short note when they cannot be loaded. */
export async function ReviewsBlock({ locale, slug, page, baseHref }: { locale: Locale; slug: string; page: number; baseHref: string }) {
  try {
    const reviews = await getProductReviews(storefrontClient(), locale, slug, { page, perPage: REVIEWS_PER_PAGE });
    return <ProductReviews reviews={reviews} locale={locale} baseHref={baseHref} />;
  } catch (error) {
    console.error('product reviews failed to load', error);
    return <ProductReviewsUnavailable locale={locale} />;
  }
}
