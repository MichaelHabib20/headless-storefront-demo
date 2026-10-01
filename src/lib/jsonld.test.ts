import { describe, expect, it } from 'vitest';
import type { Seo } from '@/sdk';
import { homeFixture, productsFixture } from '@/test/fixtures';
import { productFixture } from '@/test/product-fixtures';
import { siteSeoFixture } from '@/test/seo-fixtures';
import { breadcrumbList, collectionNode, productNode, requestOrigin, seoGraphs, serializeJsonLd, siteGraphs, targetUrl, webPageNode } from './jsonld';

const ctx = { locale: 'en' as const, origin: 'https://shop.test' };
const headers = (values: Record<string, string>) => new Headers(values);

/** A Seo with odd values: markup-looking text, a script end tag, unicode separators, nulls everywhere. */
const odd: Seo = {
  title: 'T',
  description: null,
  canonical: { type: 'product', slug: 'odd slug/ü' },
  alternates: [],
  index: true,
  breadcrumbs: [
    { label: 'Home', target: { type: 'home' } },
    { label: 'Ünïcode & <b>“quotes”</b>', target: { type: 'category', path: ['a', 'b c'] } },
    { label: 'Unknown', target: { type: 'gift-card', slug: 'x' } as unknown as Seo['canonical'] },
    { label: '</script><script>alert(1)</script>', target: null },
  ],
  structuredData: {
    product: {
      schemaType: 'Drug',
      name: '</script><script>alert(1)</script>',
      description: 'line\u2028break',
      sku: null,
      brand: null,
      images: [],
      price: 0.1,
      currency: 'EGP',
      availability: 'preorder',
      rating: null,
      category: null,
    },
  },
  pagination: null,
  openGraph: null,
};

describe('requestOrigin', () => {
  it('uses the host and protocol the visitor used, never a hardcoded host', () => {
    expect(requestOrigin(headers({ host: 'shop.example.com' }))).toBe('https://shop.example.com');
    expect(requestOrigin(headers({ host: '127.0.0.1:3302' }))).toBe('http://127.0.0.1:3302');
    expect(requestOrigin(headers({ host: 'internal:3000', 'x-forwarded-host': 'store.example, proxy', 'x-forwarded-proto': 'https,http' }))).toBe('https://store.example');
    expect(requestOrigin(headers({ host: 'localhost:3000', 'x-forwarded-proto': 'https' }))).toBe('https://localhost:3000');
  });

  it('refuses hosts that are not hosts (header injection) and works without one', () => {
    expect(requestOrigin(headers({ host: 'evil.com/"><script>' }))).toBe('');
    expect(requestOrigin(headers({}))).toBe('');
    expect(targetUrl({ type: 'home' }, { locale: 'ar', origin: '' })).toBe('/ar');
  });
});

describe('serializeJsonLd', () => {
  it('can never close the script tag or break the JS parser', () => {
    const text = serializeJsonLd({ a: '</script><!-- & \u2028\u2029' });
    expect(text).not.toMatch(/[<>&\u2028\u2029]/);
    expect(JSON.parse(text)).toEqual({ a: '</script><!-- & \u2028\u2029' });
  });
});

describe('page JSON-LD from Seo', () => {
  it('product: schema type from the backend, offer with its price, no invented members', () => {
    const node = productNode(odd, ctx)!;
    expect(node).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Drug',
      name: '</script><script>alert(1)</script>',
      description: 'line\u2028break',
      url: 'https://shop.test/en/p/odd%20slug%2F%C3%BC',
      offers: { '@type': 'Offer', url: 'https://shop.test/en/p/odd%20slug%2F%C3%BC', price: 0.1, priceCurrency: 'EGP', availability: 'https://schema.org/PreOrder' },
    });
    expect(node).not.toHaveProperty('sku');
    expect(node).not.toHaveProperty('aggregateRating');
    expect(node).not.toHaveProperty('brand');
  });

  it('product without a price has no offer (a price is never made up)', () => {
    const seo: Seo = { ...odd, structuredData: { product: { ...odd.structuredData!.product!, price: null, currency: null } } };
    expect(productNode(seo, ctx)).not.toHaveProperty('offers');
  });

  it('breadcrumbs: every crumb in order, links only where the backend gave one we can resolve', () => {
    expect(breadcrumbList(odd.breadcrumbs, ctx)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://shop.test/en' },
        { '@type': 'ListItem', position: 2, name: 'Ünïcode & <b>“quotes”</b>', item: 'https://shop.test/en/c/a/b%20c' },
        { '@type': 'ListItem', position: 3, name: 'Unknown' },
        { '@type': 'ListItem', position: 4, name: '</script><script>alert(1)</script>' },
      ],
    });
    expect(breadcrumbList([{ label: 'Home', target: { type: 'home' } }], ctx)).toBeNull();
    expect(breadcrumbList(undefined, ctx)).toBeNull();
  });

  it('the product page fixture gives Product + BreadcrumbList in both languages', () => {
    for (const locale of ['en', 'ar'] as const) {
      const details = productFixture(locale);
      const graphs = seoGraphs(details.seo, { locale, origin: 'https://shop.test' });
      expect(graphs.map((g) => g['@type'])).toEqual(['Product', 'BreadcrumbList']);
      expect(graphs[0].url).toBe(`https://shop.test/${locale}/p/${encodeURIComponent(details.product.slug)}`);
      expect((graphs[0].offers as { price: number }).price).toBe(details.seo.structuredData?.product?.price);
    }
  });

  it('a listing gives CollectionPage + ItemList + BreadcrumbList', () => {
    const listing = productsFixture('ar');
    const node = collectionNode(listing.seo, { locale: 'ar', origin: 'https://shop.test' })!;
    expect(node['@type']).toBe('CollectionPage');
    const list = node.mainEntity as { itemListElement: { position: number; url: string; name: string }[]; numberOfItems: number };
    expect(list.numberOfItems).toBe(listing.seo.structuredData!.collection!.items.length);
    expect(list.itemListElement[0]).toMatchObject({ position: 1, url: `https://shop.test/ar/p/${encodeURIComponent((listing.items[0].target as { slug: string }).slug)}` });
    expect(seoGraphs(listing.seo, { locale: 'ar', origin: '' }).map((g) => g['@type'])).toEqual(['CollectionPage', 'BreadcrumbList']);
  });

  it('home gives a WebPage; a page without facts gives nothing', () => {
    expect(webPageNode(homeFixture('en').seo!, ctx)).toMatchObject({ '@type': 'WebPage', url: 'https://shop.test/en', inLanguage: 'en' });
    expect(seoGraphs({ title: 'x', description: null, canonical: null, alternates: [], index: true }, ctx)).toEqual([]);
    expect(seoGraphs(null, ctx)).toEqual([]);
  });

  it('a legal page lists what it is about', () => {
    const seo: Seo = { ...odd, structuredData: { webPage: { schemaType: 'WebPage', name: 'Privacy', description: null, about: ['Privacy policy'] } }, canonical: { type: 'page', slug: 'privacy-policy' } };
    expect(webPageNode(seo, ctx)).toEqual({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Privacy', url: 'https://shop.test/en/pages/privacy-policy', inLanguage: 'en', about: [{ '@type': 'Thing', name: 'Privacy policy' }] });
  });
});

describe('site JSON-LD from GET /seo/site', () => {
  it('WebSite with a SearchAction, Organization and LocalBusiness, under the request origin', () => {
    const [website, organization, business] = siteGraphs(siteSeoFixture('ar'), { locale: 'ar', origin: 'http://127.0.0.1:3302' });
    expect(website).toMatchObject({
      '@type': 'WebSite',
      url: 'http://127.0.0.1:3302/ar',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: 'http://127.0.0.1:3302/ar/search?q={search_term_string}' } },
    });
    expect(organization).toMatchObject({ '@type': 'Organization', name: 'صيدليات سيف', telephone: '19199', address: { '@type': 'PostalAddress', addressCountry: 'EG' } });
    expect(business).toMatchObject({ '@type': 'Pharmacy', geo: { '@type': 'GeoCoordinates', latitude: 30.0444 }, priceRange: '$$' });
    expect((business.openingHoursSpecification as unknown[]).length).toBe(2);
  });

  it('leaves out what the store has not set (staging: no local business, no address)', () => {
    const site = siteSeoFixture('en');
    site.localBusiness = null;
    site.organization.address = null;
    site.organization.logo = null;
    site.organization.sameAs = [];
    site.website.searchable = false;
    const graphs = siteGraphs(site, ctx);
    expect(graphs.map((g) => g['@type'])).toEqual(['WebSite', 'Organization']);
    expect(graphs[0]).not.toHaveProperty('potentialAction');
    expect(graphs[1]).not.toHaveProperty('address');
    expect(graphs[1]).not.toHaveProperty('logo');
    expect(graphs[1]).not.toHaveProperty('sameAs');
    expect(siteGraphs(null, ctx)).toEqual([]);
  });
});
