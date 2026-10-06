import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';
import { createValidator } from './lib/contract.mjs';
import { createCatalogModule } from './mock/catalog.mjs';
import { createShopperStore } from './mock/shopper.mjs';
import { createVendorsModule } from './mock/vendors.mjs';

const validate = createValidator(YAML.parse(fs.readFileSync('contract/openapi.yaml', 'utf8')));

function api(locale = 'en', on = true) {
  const store = createShopperStore();
  const catalog = createCatalogModule(store);
  const vendors = createVendorsModule(store);
  vendors.reset();
  vendors.mode({ vendors: { on } });
  const call = (pathname, query = '') => {
    const request = { method: 'GET', pathname, query: new URLSearchParams(query), token: null, locale, body: null, headers: {} };
    const [status, payload] = vendors.handle(request) ?? catalog.handle(request);
    return { status, payload };
  };
  return { call, vendors };
}

describe('mock vendors follow the contract', () => {
  it('is off by default (as on staging)', () => {
    const mock = api('en', false);
    expect(mock.call('/vendors').status).toBe(404);
    expect(mock.call('/products', 'vendor=3').status).toBe(404);
    expect(mock.vendors.decorate('layout', { features: {} }, 'en').features.vendors).toBe(false);
    expect(mock.vendors.decorate('home', {}, 'en').featuredVendors).toBeUndefined();
  });

  it.each(['en', 'ar'])('the vendors page and a vendor listing (%s)', (locale) => {
    const mock = api(locale);
    const page = mock.call('/vendors');
    expect(page.status).toBe(200);
    expect(validate('VendorsResponse', page.payload)).toEqual([]);
    expect(page.payload.data.items.map((v) => v.target)).toEqual([{ type: 'vendor', id: 3 }, { type: 'vendor', id: 5 }]);

    const listing = mock.call('/products', 'vendor=3');
    expect(listing.status).toBe(200);
    expect(validate('ProductListingResponse', listing.payload)).toEqual([]);
    expect(listing.payload.data.context.type).toBe('vendor');
    expect(listing.payload.data.items.map((p) => p.id).sort((a, b) => a - b)).toEqual([7346, 36480]);
    expect(mock.call('/products', 'vendor=99').status).toBe(404);
  });

  it('home block and layout switch', () => {
    const mock = api();
    const home = JSON.parse(fs.readFileSync('src/test/fixtures/v3/home.en.json', 'utf8')).data;
    const decorated = mock.vendors.decorate('home', home, 'en');
    expect(validate('Home', decorated)).toEqual([]);
    expect(decorated.featuredVendors.items.map((v) => v.name)).toEqual(['Green Farm', 'City Pharmacy']);
    mock.vendors.mode({ vendors: { home: false } });
    expect(mock.vendors.decorate('home', home, 'en').featuredVendors).toBeUndefined();
  });
});
