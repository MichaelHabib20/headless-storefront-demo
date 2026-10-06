/**
 * Mock module: the store's sellers (contract: VendorsResponse, VendorTarget, Home.featuredVendors;
 * design: phase-b-v3-design.md §3). Public.
 *   GET /vendors → VendorsResponse (404 while multi-vendor is off)
 * The catalog module answers `GET /products?vendor={id}` with the vendor's products (VENDOR_PRODUCTS).
 * Off by default, as on staging. Switches: POST /__mode {"vendors": {"on": true | false, "home": true | false}}.
 * Test scaffolding only: the real rules are the backend's.
 */

export const VENDORS = [
  { id: 3, name: { en: 'Green Farm', ar: 'المزرعة الخضراء' }, description: { en: 'Fresh organic food from our farm.', ar: 'طعام عضوي طازج من مزرعتنا.' }, image: 'https://cdn.supercommerce.io/supercommerce-demo/uploads/vendor-green-farm.png' },
  { id: 5, name: { en: 'City Pharmacy', ar: 'صيدلية المدينة' }, description: { en: null, ar: null }, image: null },
];

/** vendor id → product ids it sells (products of the shopper store's catalogue). */
export const VENDOR_PRODUCTS = { 3: [36480, 7346], 5: [14482] };

const TEXT = {
  en: { title: 'Vendors', hint: 'Shop the products of one seller.', not_found: 'Not found.' },
  ar: { title: 'البائعون', hint: 'تسوّق منتجات بائع واحد.', not_found: 'غير موجود.' },
};

const STATES = new WeakMap();

/** The vendors switch of the shopper store, shared with the catalog module. */
export function vendorsState(shopper) {
  let state = STATES.get(shopper);
  if (!state) {
    let mode = { on: false, home: true };
    state = {
      get on() {
        return mode.on;
      },
      get home() {
        return mode.on && mode.home;
      },
      mode: () => ({ ...mode }),
      setMode(input) {
        mode = { ...mode, ...input };
      },
      reset() {
        mode = { on: false, home: true };
      },
    };
    STATES.set(shopper, state);
  }
  return state;
}

export const vendorTarget = (id) => ({ type: 'vendor', id });

export function vendorTile(row, locale) {
  return { id: row.id, name: row.name[locale], image: row.image ? { url: row.image, alt: row.name[locale] } : null, target: vendorTarget(row.id) };
}

export function createVendorsModule(shopper) {
  const state = vendorsState(shopper);
  return {
    handle({ method, pathname, locale }) {
      if (pathname !== '/vendors' || method !== 'GET') return null;
      if (!state.on) return [404, { error: { code: 'not_found', message: TEXT[locale].not_found } }];
      return [200, { data: { title: TEXT[locale].title, hint: TEXT[locale].hint, items: VENDORS.map((row) => ({ ...vendorTile(row, locale), description: row.description[locale] })) } }];
    },
    /** POST /__mode {"vendors": {...}} */
    mode(body) {
      if (body && typeof body.vendors === 'object' && body.vendors) state.setMode(body.vendors);
      return { vendors: state.mode() };
    },
    /** The layout switch, and the home block when the store shows it. */
    decorate(endpoint, data, locale) {
      if (endpoint === 'layout') return { ...data, features: { ...data.features, vendors: state.on } };
      if (endpoint === 'home' && state.home) return { ...data, featuredVendors: { title: TEXT[locale].title, items: VENDORS.map((row) => vendorTile(row, locale)) } };
      return data;
    },
    reset() {
      state.reset();
    },
  };
}
