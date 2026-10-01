/**
 * SEO and marketing endpoints (contract: contract/openapi.yaml, getSiteSeo / getSitemap / trackEvent).
 * Site facts and sitemap entries are the same for everyone (cached reads); events carry the
 * shopper's token when there is one and are never cached.
 */
import type { StorefrontClient } from './http';
import type { EventAccepted, EventRequest, Locale, SiteSeo, SitemapPage, SitemapType } from './types';

interface Ctx {
  locale: Locale;
  token: string | null;
}

/** Organization / local business / website facts for JSON-LD, Google verification and the robots policy. */
export const getSiteSeo = (client: StorefrontClient, locale: Locale) => client.get<SiteSeo>('seo/site', locale);

/** One page of sitemap entries of one type (Targets; the storefront writes the URLs). */
export const getSitemap = (client: StorefrontClient, locale: Locale, type: SitemapType, { page = 1, perPage }: { page?: number; perPage?: number } = {}) =>
  client.request<SitemapPage>('GET', 'sitemap', { locale, query: { type, page, perPage } });

/**
 * A server-side marketing event (conversion APIs). Send ids only: the backend looks up names and
 * prices itself. Always accepted (202) unless the body breaks the contract.
 */
export const trackEvent = (client: StorefrontClient, { locale, token }: Ctx, event: EventRequest) =>
  client.request<EventAccepted>('POST', 'events', { locale, token, body: event });
