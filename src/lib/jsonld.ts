import { createElement, Fragment, type ReactElement } from 'react';
import type { Breadcrumb, Locale, PostalAddress, Seo, SiteSeo, Target } from '@/sdk';
import { resolveTarget, routes, searchUrlTemplate } from './routing';
import { SeoLinks } from './seo';

/**
 * JSON-LD (schema.org structured data). The ONLY file that writes `application/ld+json`.
 *
 * The facts come from the backend (`Seo.structuredData`, `Seo.breadcrumbs`, `GET /seo/site`); this
 * file only turns Targets into absolute URLs of this storefront (the origin of the request, never a
 * hardcoded host) and writes schema.org vocabulary around them. It never adds a fact: a member the
 * backend sent as null is left out, an unknown member is skipped.
 */

export interface JsonLdContext {
  locale: Locale;
  /** `https://shop.example` (no trailing slash), from the request; '' → URLs stay relative. */
  origin: string;
}

type Node = Record<string, unknown>;

const CONTEXT = 'https://schema.org';

const AVAILABILITY: Record<string, string> = {
  in_stock: 'https://schema.org/InStock',
  out_of_stock: 'https://schema.org/OutOfStock',
  preorder: 'https://schema.org/PreOrder',
  discontinued: 'https://schema.org/Discontinued',
};

/** Headers of the request (next/headers or a plain Headers in tests). */
interface HeaderReader {
  get(name: string): string | null;
}

const HOST = /^[A-Za-z0-9.-]+(:\d{1,5})?$|^\[[0-9A-Fa-f:.]+\](:\d{1,5})?$/;

/** The public origin the visitor used: `x-forwarded-host` / `host` and `x-forwarded-proto`. */
export function requestOrigin(headers: HeaderReader): string {
  const host = (headers.get('x-forwarded-host') ?? headers.get('host') ?? '').split(',')[0].trim();
  if (!HOST.test(host)) return '';
  const forwarded = (headers.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(host);
  const proto = forwarded === 'http' || forwarded === 'https' ? forwarded : local ? 'http' : 'https';
  return `${proto}://${host}`;
}

/** Absolute URL of a Target in this storefront; null when the Target is not a link here. */
export function targetUrl(target: Target | null | undefined, ctx: JsonLdContext): string | null {
  const link = resolveTarget(target, ctx.locale);
  if (!link) return null;
  return link.external ? link.href : ctx.origin + link.href;
}

/** Text safe inside <script>: `<`, `>`, `&` and the JS line separators are escaped. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Drops null / undefined / empty-array members (a fact the backend did not send is not written). */
function compact(node: Node): Node {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)));
}

export function breadcrumbList(crumbs: readonly Breadcrumb[] | undefined, ctx: JsonLdContext): Node | null {
  if (!crumbs || crumbs.length < 2) return null;
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => compact({ '@type': 'ListItem', position: index + 1, name: crumb.label, item: targetUrl(crumb.target, ctx) })),
  };
}

export function productNode(seo: Seo, ctx: JsonLdContext): Node | null {
  const product = seo.structuredData?.product;
  if (!product) return null;
  const url = targetUrl(seo.canonical, ctx);
  const offer =
    product.price === null || product.price === undefined
      ? null
      : compact({ '@type': 'Offer', url, price: product.price, priceCurrency: product.currency, availability: AVAILABILITY[product.availability] });
  const rating = product.rating ? { '@type': 'AggregateRating', ratingValue: product.rating.average, reviewCount: product.rating.count } : null;
  return compact({
    '@context': CONTEXT,
    '@type': product.schemaType,
    name: product.name,
    description: product.description,
    sku: product.sku,
    gtin: product.gtin,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : null,
    image: product.images,
    category: product.category,
    url,
    offers: offer,
    aggregateRating: rating,
  });
}

export function collectionNode(seo: Seo, ctx: JsonLdContext): Node | null {
  const collection = seo.structuredData?.collection;
  if (!collection) return null;
  return compact({
    '@context': CONTEXT,
    '@type': 'CollectionPage',
    name: collection.name,
    description: collection.description,
    url: targetUrl(seo.canonical, ctx),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: collection.items.length,
      itemListElement: collection.items.map((item, index) => compact({ '@type': 'ListItem', position: index + 1, name: item.name, url: targetUrl(item.target, ctx), image: item.image })),
    },
  });
}

export function webPageNode(seo: Seo, ctx: JsonLdContext): Node | null {
  const page = seo.structuredData?.webPage;
  if (!page) return null;
  return compact({
    '@context': CONTEXT,
    '@type': page.schemaType,
    name: page.name,
    description: page.description,
    url: targetUrl(seo.canonical, ctx),
    inLanguage: ctx.locale,
    about: page.about?.map((name) => ({ '@type': 'Thing', name })),
  });
}

/** Every JSON-LD block of a page's `Seo`: its structured data, then its breadcrumb trail. */
export function seoGraphs(seo: Seo | null | undefined, ctx: JsonLdContext): Node[] {
  if (!seo) return [];
  return [productNode(seo, ctx), collectionNode(seo, ctx), webPageNode(seo, ctx), breadcrumbList(seo.breadcrumbs, ctx)].filter((node): node is Node => node !== null);
}

function postalAddress(address: PostalAddress | null | undefined): Node | null {
  if (!address) return null;
  const node = compact({
    '@type': 'PostalAddress',
    streetAddress: address.street,
    addressLocality: address.locality,
    addressRegion: address.region,
    postalCode: address.postalCode,
    addressCountry: address.country,
  });
  return Object.keys(node).length > 1 ? node : null;
}

/** The site-wide blocks (every page): WebSite (+ SearchAction), Organization, LocalBusiness. */
export function siteGraphs(site: SiteSeo | null | undefined, ctx: JsonLdContext): Node[] {
  if (!site) return [];
  const home = ctx.origin + routes.home(ctx.locale);
  const organizationId = `${ctx.origin}/#organization`;
  const { organization, localBusiness, website } = site;
  const graphs: Node[] = [
    compact({
      '@context': CONTEXT,
      '@type': 'WebSite',
      '@id': `${ctx.origin}/#website`,
      name: website.name || organization.name,
      url: home,
      inLanguage: ctx.locale,
      publisher: { '@id': organizationId },
      potentialAction: website.searchable
        ? { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: ctx.origin + searchUrlTemplate(ctx.locale) }, 'query-input': 'required name=search_term_string' }
        : null,
    }),
    compact({
      '@context': CONTEXT,
      '@type': 'Organization',
      '@id': organizationId,
      name: organization.name,
      legalName: organization.legalName,
      url: home,
      logo: organization.logo,
      sameAs: organization.sameAs,
      telephone: organization.telephone,
      email: organization.email,
      address: postalAddress(organization.address),
    }),
  ];
  if (localBusiness) {
    graphs.push(
      compact({
        '@context': CONTEXT,
        '@type': localBusiness.schemaType,
        name: localBusiness.name,
        url: home,
        image: localBusiness.images,
        telephone: localBusiness.telephone,
        address: postalAddress(localBusiness.address),
        geo: localBusiness.geo ? { '@type': 'GeoCoordinates', latitude: localBusiness.geo.latitude, longitude: localBusiness.geo.longitude } : null,
        openingHoursSpecification: localBusiness.openingHours.map((hours) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: hours.days, opens: hours.opens, closes: hours.closes })),
        priceRange: localBusiness.priceRange,
        parentOrganization: { '@id': organizationId },
      }),
    );
  }
  return graphs;
}

function scripts(graphs: Node[], testId: string): ReactElement | null {
  if (!graphs.length) return null;
  return createElement(
    Fragment,
    null,
    ...graphs.map((graph, index) =>
      // The one sanctioned raw-HTML write: JSON, escaped for <script> by serializeJsonLd.
      createElement('script', { key: index, type: 'application/ld+json', 'data-testid': testId, dangerouslySetInnerHTML: { __html: serializeJsonLd(graph) } }),
    ),
  );
}

/** `metadataBase` for Next.js metadata (absolute canonical / og:url / hreflang), from the request origin. */
export async function requestMetadataBase(): Promise<URL | undefined> {
  const { headers } = await import('next/headers');
  const origin = requestOrigin(await headers());
  return origin ? new URL(origin) : undefined;
}

async function context(locale: Locale): Promise<JsonLdContext> {
  const { headers } = await import('next/headers');
  return { locale, origin: requestOrigin(await headers()) };
}

/**
 * Drop-in for any page with a backend `Seo` (product, listings, home, CMS / landing pages, forms):
 * writes its JSON-LD and the head links metadata cannot express (rel=prev/next, og:type=product).
 *
 *   <JsonLd seo={page.seo} locale={locale} />
 */
export async function JsonLd({ seo, locale }: { seo: Seo | null | undefined; locale: Locale }) {
  if (!seo) return null;
  const ctx = await context(locale);
  return createElement(Fragment, null, scripts(seoGraphs(seo, ctx), 'jsonld'), createElement(SeoLinks, { seo, locale }));
}

/** The site-wide JSON-LD (WebSite + SearchAction, Organization, LocalBusiness), once per page. */
export async function SiteJsonLd({ locale }: { locale: Locale }) {
  const { loadSiteSeo } = await import('./seo.server');
  const site = await loadSiteSeo(locale);
  return scripts(siteGraphs(site, await context(locale)), 'jsonld-site');
}
