/**
 * Product page endpoints (contract: contract/openapi.yaml, "shopping"). The backend picks the
 * variant, prices it, decides every option's state and where each option value leads.
 * Reads work without a token; with one, prices and limits are the shopper's (and never cached).
 */
import type { StorefrontClient } from './http';
import type { Locale, MessageResult, NotifyMeResult, ProductDetails, ProductRecommendations, ProductReviewsPage, WriteReviewInput } from './types';

interface Ctx {
  locale: Locale;
  token: string | null;
}

interface PageQuery {
  page?: number;
  perPage?: number;
}

/** A slug is one path segment, in either language (Arabic slugs too). */
const productPath = (slug: string) => `products/${encodeURIComponent(slug)}`;

/** The product page. `redirect` is set when the slug is not this product's address in this language. */
export const getProduct = (client: StorefrontClient, ctx: Ctx, slug: string) =>
  client.request<ProductDetails>('GET', productPath(slug), ctx);

/** Product rows for the product page (related, similar, bought together), in the order to show them. */
export const getProductRecommendations = (client: StorefrontClient, ctx: Ctx, slug: string) =>
  client.request<ProductRecommendations>('GET', `${productPath(slug)}/recommendations`, ctx);

/**
 * Rating summary and one page of reviews. Public; a shopper token (when the visitor has one) only
 * decides `write.requiresSignIn` — the read is never cached with a token and never creates one.
 */
export const getProductReviews = (client: StorefrontClient, locale: Locale, slug: string, { page, perPage }: PageQuery = {}, token: string | null = null) =>
  client.request<ProductReviewsPage>('GET', `${productPath(slug)}/reviews`, { locale, token, query: { page, perPage } });

/**
 * Writes a review (moderated: it shows once approved). Needs a shopper token. Whether the shopper
 * may write one is `ProductReviewsPage.write`; the backend answers 403 `feature_disabled`,
 * 422 `validation_failed` (`fields.orderId` when the store wants a delivered order) or 404.
 */
export const writeReview = (client: StorefrontClient, ctx: Ctx, input: WriteReviewInput) =>
  client.request<MessageResult>('POST', 'reviews', { ...ctx, body: input });

/**
 * "Tell me when it is back". Needs a shopper token (a guest is fine). The email is sent only when
 * the shopper typed one; the backend answers 422 `validation_failed` with `fields.email` when it
 * needs one, and 409 `already_available` when the product is in stock.
 */
export const notifyWhenAvailable = (client: StorefrontClient, ctx: Ctx, productId: number, email?: string | null) =>
  client.request<NotifyMeResult>('POST', `products/${productId}/notify-me`, { ...ctx, body: email ? { email } : {} });
