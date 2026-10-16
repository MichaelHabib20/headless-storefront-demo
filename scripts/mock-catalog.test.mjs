import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCatalogModule } from './mock/catalog.mjs';
import { createModules } from './mock/modules.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

function api(locale = 'en') {
  const store = createShopperStore();
  const catalog = createCatalogModule(store);
  const get = (pathname, query = '') => {
    const [status, payload] = catalog.handle({ method: 'GET', pathname, query: new URLSearchParams(query), token: null, locale, body: null });
    return { status, payload, data: payload.data };
  };
  return { get, store };
}

function expectValid(schema, payload) {
  expect(validate(schema, payload)).toEqual([]);
}

/** Every `query` string a listing carries. */
function queries(listing) {
  return [
    ...listing.sort.map((s) => s.query),
    ...listing.facets.flatMap((f) => [...f.values.map((v) => v.query), ...(f.range ? [f.range.query] : [])]),
    ...listing.appliedFilters.map((c) => c.removeQuery),
    ...(listing.clearFiltersQuery === null ? [] : [listing.clearFiltersQuery]),
  ];
}

describe('mock catalog module follows the contract', () => {
  it.each(['en', 'ar'])('every scope, filter state and endpoint (%s)', (locale) => {
    const { get } = api(locale);
    const listings = [
      '',
      'category=mom-baby',
      'category=mom-baby/baby-care/baby-toiletries-bath-accessories&options=color-lavender&priceMin=100&sort=price_desc',
      'brand=johnson-johnson&inStock=true',
      'brand=bioderma',
      'list=125',
      'list=best-sellers&page=2',
      'tag=new-arrivals',
      'deals=true',
      'deals=true&category=mom-baby',
      'q=cologne',
      'q=zzzz',
      'category=mom-baby&q=bath',
      'brand=johnson-johnson&q=bath&sort=price_asc',
      'deals=true&category=mom-baby&q=bath',
      'priceMax=100&brands=johnson-johnson&categories=hair-care',
    ];
    for (const query of listings) {
      const answer = get('/products', query);
      expect(answer.status, query).toBe(200);
      expectValid('ProductListingResponse', answer.payload);
      // every link the backend writes leads to a valid listing again
      for (const link of queries(answer.data)) {
        // `query` strings never carry q: the page keeps it next to them (a search inside the listing)
        expect(link, link).not.toMatch(/(^|&)q=/);
        const scope = query.split('&').filter((p) => /^(category|brand|list|tag|deals|q)=/.test(p)).join('&');
        const next = get('/products', [scope, link].filter(Boolean).join('&'));
        expect(next.status, `${query} → ${link}`).toBe(200);
      }
    }
    expectValid('SearchSuggestionsResponse', get('/search/suggestions', 'q=johnson').payload);
    expectValid('CategoriesResponse', get('/categories').payload);
    expectValid('BrandsResponse', get('/brands', 'perPage=24&page=2').payload);
    for (const path of ['/en/product/36480/x', '/en/summer-sale', '/en/our-blog', '/en/brand/758', '/ar/blog/x', '/en/under-construction', '/en/discontinued-offer', '/en/self-redirect', '/en/unsafe-redirect', '/en/nothing-here']) {
      expectValid('ResolutionResponse', get('/resolve', `path=${encodeURIComponent(path)}`).payload);
    }
    for (const [pathname, query, status] of [
      ['/products', 'category=nope', 404],
      ['/products', 'brand=nope', 404],
      ['/products', 'priceMin=abc', 422],
      ['/products', 'page=0', 422],
      ['/products', 'brand=a&tag=b', 422],
      ['/products', 'deals=true&brand=bioderma', 422],
      ['/products', 'deals=true&category=nope', 404],
      ['/search/suggestions', 'q=', 422],
      ['/resolve', '', 422],
    ]) {
      const answer = get(pathname, query);
      expect(answer.status, `${pathname}?${query}`).toBe(status);
      expectValid('ErrorResponse', answer.payload);
    }
  });

  it('filters, sorts and pages for real', () => {
    const { get } = api();
    const all = get('/products').data;
    expect(all.pagination).toEqual({ page: 1, perPage: 8, total: 10, totalPages: 2 });
    expect(get('/products', 'page=2').data.items).toHaveLength(2);

    const colors = all.facets.find((f) => f.key === 'color');
    expect(colors.display).toBe('color');
    const lavender = colors.values.find((v) => v.label === 'Lavender');
    const filtered = get('/products', lavender.query).data;
    expect(filtered.pagination.total).toBe(lavender.count);
    expect(filtered.appliedFilters).toEqual([{ label: 'Lavender', removeQuery: '' }]);
    expect(filtered.clearFiltersQuery).toBe('');
    expect(filtered.facets.find((f) => f.key === 'color').values.find((v) => v.label === 'Lavender').selected).toBe(true);

    const cheapFirst = get('/products', all.sort.find((s) => s.query === 'sort=price_asc').query).data.items.map((p) => p.price.amount);
    expect(cheapFirst).toEqual([...cheapFirst].sort((a, b) => a - b));

    const ranged = get('/products', 'priceMin=100&priceMax=150').data;
    expect(ranged.items.every((p) => p.price.amount >= 100 && p.price.amount <= 150)).toBe(true);
    expect(ranged.appliedFilters.map((c) => c.label)).toEqual(['100 EGP – 150 EGP']);
    expect(get('/products', 'priceMin=&priceMax=').data.pagination.total).toBe(10);

    expect(get('/products', 'q=zzzz').data.items).toEqual([]);
    expect(get('/products', 'q=zzzz').data.context).toMatchObject({ type: 'search', query: 'zzzz' });
  });

  it('searches inside a listing: q with a scope keeps the scope page, noindex', () => {
    const { get } = api();
    const category = get('/products', 'category=mom-baby').data;
    const inside = get('/products', 'category=mom-baby&q=bath').data;
    expect(inside.context).toMatchObject({ type: 'category', title: category.context.title, query: 'bath' });
    expect(inside.breadcrumbs).toEqual(category.breadcrumbs);
    expect(inside.seo).toMatchObject({ canonical: category.seo.canonical, index: false });
    expect(inside.pagination.total).toBeLessThan(category.pagination.total);
    expect(inside.items.every((p) => /bath/i.test(p.name))).toBe(true);
    expect(get('/products', 'category=mom-baby&q=').data).toMatchObject({ context: { query: null }, seo: { index: true } });
    expect(get('/products', 'deals=true&category=mom-baby&q=bath').data.context).toMatchObject({ type: 'deals', query: 'bath' });
    expect(get('/products', 'brand=a&tag=b&q=x').status).toBe(422);

    const arabic = api('ar').get('/products', `category=mom-baby&q=${encodeURIComponent('شامبو')}`).data;
    expect(arabic.context).toMatchObject({ type: 'category', query: 'شامبو' });
    expect(arabic.items.map((p) => p.name)).toEqual([expect.stringContaining('شامبو')]);
  });

  it('deals show an old price next to the price shoppers pay everywhere', () => {
    const { get, store } = api();
    const deal = get('/products', 'deals=true').data.items[0];
    expect(deal.price.compareAtDisplay).not.toBeNull();
    expect(deal.price.amount).toBe(store.product(deal.id, 'en').price.amount);
  });

  it('deals of one category: only the deals of that category, canonical deals + category', () => {
    for (const locale of ['en', 'ar']) {
      const { get } = api(locale);
      const listing = get('/products', 'deals=true&category=mom-baby').data;
      const all = get('/products', 'deals=true').data;
      expect(listing.items.length).toBeGreaterThan(0);
      expect(listing.items.length).toBeLessThan(all.items.length);
      expect(listing.seo.canonical).toEqual({ type: 'deals', category: ['mom-baby'] });
      expect(listing.seo.index).toBe(true);
      expect(listing.context.type).toBe('deals');
      expect(listing.context.title).toMatch(locale === 'en' ? /^Deals: / : /^عروض /);
      expect(listing.breadcrumbs.map((c) => c.target)).toEqual([{ type: 'home' }, { type: 'deals' }, { type: 'deals', category: ['mom-baby'] }]);
    }
  });

  it('like the backend, any query but page, locale and the scope makes a listing noindex', () => {
    const { get } = api();
    expect(get('/products', 'list=best-sellers&locale=en').data.seo.index).toBe(true);
    expect(get('/products', 'list=best-sellers&list_ids=7').data.seo.index).toBe(false);
    expect(get('/products', 'category=mom-baby&utm_source=x').data.seo.index).toBe(false);
  });

  it('resolves old URLs and the redirect table', () => {
    const { get } = api('ar');
    const resolve = (path) => get('/resolve', `path=${encodeURIComponent(path)}`).data;
    expect(resolve('/ar/products/old-name/36480')).toMatchObject({ result: 'target', target: { type: 'product' }, permanent: true });
    expect(resolve('/en/summer-sale')).toMatchObject({ result: 'redirect', target: { type: 'deals' }, permanent: false });
    expect(resolve('/en/our-blog')).toMatchObject({ result: 'redirect', url: 'https://blog.example.com/', permanent: true });
    expect(resolve('/ar/brand/758')).toMatchObject({ result: 'target', target: { type: 'brand', slug: 'bioderma' }, permanent: true });
    expect(resolve('/en/brand/999999')).toMatchObject({ result: 'not_found' });
    expect(resolve('/en/blog')).toMatchObject({ result: 'target', target: { type: 'home' }, permanent: true });
    expect(resolve('/en/under-construction')).toMatchObject({ result: 'target', target: { type: 'home' } });
    expect(resolve('/en/discontinued-offer').result).toBe('gone');
    expect(resolve('/en/product/999999').result).toBe('not_found');
    expect(resolve('/en/definitely-not-a-page/x').result).toBe('not_found');
  });

  it('answers only from the redirect table with only=redirects', () => {
    const { get } = api('en');
    const only = (path) => get('/resolve', `path=${encodeURIComponent(path)}&only=redirects`).data;
    expect(only('/en/products/tag/old-tag')).toMatchObject({ result: 'redirect', target: { type: 'deals' }, permanent: true });
    expect(only('/en/product/retired-category').result).toBe('gone');
    expect(only('/en/products/old-name/36480').result).toBe('none');
    expect(only('/en/blog').result).toBe('none');
  });

  it('sends no facets with side filters off (the backend switch), until reset', () => {
    const catalog = createCatalogModule(createShopperStore());
    const list = (query) => catalog.handle({ method: 'GET', pathname: '/products', query: new URLSearchParams(query), token: null, locale: 'en', body: null })[1];
    expect(list('category=every-day-essentials').data.facets.length).toBeGreaterThan(0);
    expect(catalog.mode({ sideFilters: false })).toEqual({ sideFilters: false });
    expect(catalog.mode({ fail: true })).toEqual({ sideFilters: false });
    const off = list('category=every-day-essentials');
    expectValid('ProductListingResponse', off);
    expect(off.data.facets).toEqual([]);
    expect(off.data.items.length).toBeGreaterThan(0);
    catalog.reset();
    expect(list('category=every-day-essentials').data.facets.length).toBeGreaterThan(0);
  });

  it('is part of the mock API', () => {
    const request = { method: 'GET', pathname: '/categories', locale: 'en', query: new URLSearchParams(), token: null, body: null };
    expect(createModules(createShopperStore()).some((part) => part.handle(request))).toBe(true);
    expect(createCatalogModule(createShopperStore()).handle({ ...request, method: 'POST' })).toBeNull();
    expect(createCatalogModule(createShopperStore()).handle({ ...request, pathname: '/cart' })).toBeNull();
  });
});
