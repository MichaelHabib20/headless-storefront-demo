import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCatalogModule } from './mock/catalog.mjs';
import { createModules } from './mock/modules.mjs';
import { createProductModule } from './mock/product.mjs';
import { createSeoModule, homeSeo, MOCK_MARKETING } from './mock/seo.mjs';
import { createShopperStore } from './mock/shopper.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));
const request = (locale, pathname, { method = 'GET', query = '', body = null, token = null } = {}) => ({ method, pathname, locale, query: new URLSearchParams(query), token, body });

describe('mock seo module follows the contract', () => {
  it.each(['en', 'ar'])('GET /seo/site (%s)', (locale) => {
    const [status, body] = createSeoModule(createShopperStore()).handle(request(locale, '/seo/site'));
    expect(status).toBe(200);
    expect(validate('SiteSeoResponse', body)).toEqual([]);
    expect(body.data.localBusiness.openingHours.length).toBeGreaterThan(0);
  });

  it.each(['products', 'categories', 'brands', 'pages', 'landing_pages', 'tags'])('GET /sitemap?type=%s in both languages', (type) => {
    const seo = createSeoModule(createShopperStore());
    for (const locale of ['en', 'ar']) {
      const [status, body] = seo.handle(request(locale, '/sitemap', { query: `type=${type}&perPage=3` }));
      expect(status).toBe(200);
      expect(validate('SitemapResponse', body)).toEqual([]);
      expect(body.data.items.length).toBeGreaterThan(0);
      for (const item of body.data.items) expect(item.alternates.map((a) => a.locale)).toEqual(['en', 'ar']);
    }
  });

  it('pages the sitemap and refuses bad parameters', () => {
    const seo = createSeoModule(createShopperStore());
    const first = seo.handle(request('en', '/sitemap', { query: 'type=products&perPage=4' }))[1].data;
    const second = seo.handle(request('en', '/sitemap', { query: 'type=products&perPage=4&page=2' }))[1].data;
    expect(second.pagination).toMatchObject({ page: 2, perPage: 4, total: first.pagination.total });
    expect(second.items[0]).not.toEqual(first.items[0]);
    for (const query of ['', 'type=orders', 'type=products&page=0', 'type=products&perPage=5001']) {
      const [status, body] = seo.handle(request('en', '/sitemap', { query }));
      expect(status).toBe(422);
      expect(validate('ErrorResponse', body)).toEqual([]);
    }
  });

  it('accepts events (202), keeps them for the e2e, de-duplicates eventId and refuses bodies outside the contract', () => {
    const seo = createSeoModule(createShopperStore());
    const event = { name: 'add_to_cart', eventId: 'e-1', productIds: [9822], page: { path: '/en/p/x', referrer: null }, clickIds: { fbclid: 'abc' } };
    expect(validate('EventRequest', event)).toEqual([]);

    const [status, body] = seo.handle(request('en', '/events', { method: 'POST', body: event, token: 'guest-1' }));
    expect(status).toBe(202);
    expect(validate('EventAcceptedResponse', body)).toEqual([]);
    expect(seo.handle(request('en', '/events', { method: 'POST', body: event }))[1]).toEqual({ data: { accepted: false } });
    expect(seo.control('GET', '/__events')[1].events).toEqual([{ ...event, token: 'guest-1', locale: 'en' }]);

    for (const bad of [{}, { name: 'refund' }, { name: 'view_item', price: 10 }, { name: 'view_item', productIds: ['x'] }, { name: 'page_view', page: {} }]) {
      const [badStatus, error] = seo.handle(request('ar', '/events', { method: 'POST', body: bad }));
      expect(badStatus).toBe(422);
      expect(validate('ErrorResponse', error)).toEqual([]);
    }
    seo.reset();
    expect(seo.control('GET', '/__events')[1].events).toEqual([]);
  });

  it('adds Layout.marketing (ids only while switched on) and Home.seo to the recorded answers', () => {
    const seo = createSeoModule(createShopperStore());
    for (const locale of ['en', 'ar']) {
      const layout = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/layout.${locale}.json`, 'utf8')).data;
      const home = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data;
      const off = seo.decorate('layout', layout, locale);
      expect(off.marketing.gtmId).toBeNull();
      expect(validate('Layout', off)).toEqual([]);
      expect(validate('Home', seo.decorate('home', home, locale))).toEqual([]);
      expect(seo.decorate('home', home, locale).seo).toEqual(homeSeo(locale));
    }
    seo.control('POST', '/__seo', { marketing: true, robotsIndex: false });
    expect(seo.decorate('layout', {}, 'en').marketing).toEqual(MOCK_MARKETING);
    expect(seo.handle(request('en', '/seo/site'))[1].data.robots.index).toBe(false);
    seo.reset();
    expect(seo.handle(request('en', '/seo/site'))[1].data.robots.index).toBe(true);
  });

  it('product and listing answers carry the SEO members', () => {
    const store = createShopperStore();
    const slug = encodeURIComponent(store.product(9822, 'en').slug);
    const product = createProductModule(store).handle(request('en', `/products/${slug}`))[1].data;
    expect(product.seo.structuredData.product).toMatchObject({ schemaType: 'Product', name: product.product.name, price: product.product.price.amount });
    expect(product.seo.breadcrumbs[0].target).toEqual({ type: 'home' });
    expect(product.seo.breadcrumbs.at(-1).target).toBeNull();

    const listing = createCatalogModule(store).handle(request('ar', '/products', { query: 'perPage=2' }))[1].data;
    expect(validate('ProductListing', listing)).toEqual([]);
    expect(listing.seo.pagination).toEqual({ prev: null, next: 2 });
    expect(listing.seo.structuredData.collection.items).toHaveLength(2);
  });

  it('is part of the mock API', () => {
    const answers = createModules(createShopperStore()).map((part) => part.handle(request('en', '/seo/site')));
    expect(answers.some(Boolean)).toBe(true);
  });
});
