/**
 * Mock module: SEO + marketing.
 *   GET  /seo/site      → SiteSeoResponse (every fact set, LocalBusiness included: staging has none)
 *   GET  /sitemap       → SitemapResponse (?type=products|categories|brands|pages|landing_pages|tags, ?page, ?perPage);
 *                          422 validation_failed for a missing / unknown type or a bad page
 *   POST /events        → 202 EventAcceptedResponse; 422 for a body outside EventRequest. Every accepted
 *                          event is kept (with the token it came with); a repeated eventId → accepted: false
 *
 * Test controls (outside /api, like /__reset):
 *   GET  /__events                       → { events: [...] } what POST /events received, oldest first
 *   POST /__seo { marketing, robotsIndex } → Layout.marketing ids on / off (default off, so other specs never
 *                                           load third-party tags), the site's robots policy (default true)
 *
 * Decorations of the recorded answers: `Layout.marketing` (ids only while switched on) and `Home.seo`.
 * Product and listing `Seo` members come from productSeoExtras / listingSeoExtras (used by product.mjs
 * and catalog.mjs). Everything follows the contract (scripts/mock-seo.test.mjs).
 */
import { createCatalogModule } from './catalog.mjs';
export { listingSeoExtras, productSeoExtras } from './seo-extras.mjs';

const TEXT = {
  en: { store: 'Seif Pharmacies', home: 'Home', title: 'Any time Any where', description: 'Your pharmacy and beauty store, delivered any time, anywhere.' },
  ar: { store: 'صيدليات سيف', home: 'الرئيسية', title: 'اى وقت واى مكان', description: 'صيدليتك ومتجر جمالك، يصلك في أي وقت وأي مكان.' },
};

const LOGO = 'https://seif-online.com/storage/seif-pharmacies/uploads/logo 700 X 350 E-1746024674.png';

/** Ids a test can switch on (fake ids: the e2e spec blocks the tag hosts). */
export const MOCK_MARKETING = {
  gtmId: 'GTM-MOCK123',
  googleAnalyticsIds: ['G-MOCK45678'],
  googleAds: { conversionId: 'AW-1234567', labels: { purchase: 'mockPurchase', add_to_cart: 'mockCart' } },
  facebookPixelId: '1234567890',
  tiktokPixelId: 'MOCKTIKTOK01',
  snapchatPixelId: null,
  clarityId: null,
  hotjarId: null,
};
export const NO_MARKETING = { gtmId: null, googleAnalyticsIds: [], googleAds: null, facebookPixelId: null, tiktokPixelId: null, snapchatPixelId: null, clarityId: null, hotjarId: null };

const EVENT_NAMES = ['page_view', 'view_item', 'view_item_list', 'search', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'sign_up', 'login', 'add_to_wishlist', 'select_promotion'];
const EVENT_KEYS = { '': ['name', 'eventId', 'page', 'clickIds', 'browser', 'productIds', 'orderId', 'searchTerm'], page: ['path', 'referrer'], clickIds: ['fbclid', 'gclid', 'ttclid', 'sccid'], browser: ['fbp', 'fbc'] };
const SITEMAP_TYPES = ['products', 'categories', 'brands', 'pages', 'landing_pages', 'tags'];

/** `Home.seo` (the recorded home predates it). */
export function homeSeo(locale) {
  const t = TEXT[locale];
  const home = { type: 'home' };
  return {
    title: t.title,
    description: t.description,
    canonical: home,
    alternates: [{ locale: 'en', target: home }, { locale: 'ar', target: home }],
    index: true,
    breadcrumbs: [],
    structuredData: { webPage: { schemaType: 'WebPage', name: t.title, description: t.description } },
    pagination: null,
    openGraph: { title: t.store, description: null, image: LOGO, type: 'website' },
  };
}

export function siteSeo(locale, robotsIndex = true) {
  const t = TEXT[locale];
  const address = { street: '12 Tahrir St.', locality: 'Cairo', region: 'Cairo Governorate', postalCode: '11511', country: 'EG' };
  return {
    organization: {
      name: t.store,
      legalName: null,
      logo: LOGO,
      sameAs: ['https://www.facebook.com/SEIFPharmacy', 'https://www.instagram.com/Seif_pharmacies/'],
      telephone: '19199',
      email: 'info@seif-online.com',
      address,
    },
    localBusiness: {
      schemaType: 'Pharmacy',
      name: t.store,
      images: [LOGO],
      telephone: '19199',
      address,
      geo: { latitude: 30.0444, longitude: 31.2357 },
      openingHours: [
        { days: ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '09:00', closes: '23:00' },
        { days: ['Friday'], opens: '14:00', closes: '23:00' },
      ],
      priceRange: '$$',
    },
    website: { name: t.store, searchable: true },
    verification: { google: 'mock-google-verification-1' },
    robots: { index: robotsIndex },
  };
}

function eventErrors(body, locale) {
  const fields = {};
  const unknown = locale === 'ar' ? 'هذا الحقل غير مسموح به.' : 'This field is not allowed.';
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { name: ['required'] };
  for (const [parent, keys] of Object.entries(EVENT_KEYS)) {
    const node = parent ? body[parent] : body;
    if (!node || typeof node !== 'object') continue;
    for (const key of Object.keys(node)) if (!keys.includes(key)) fields[parent ? `${parent}.${key}` : key] = [unknown];
  }
  if (!EVENT_NAMES.includes(body.name)) fields.name = ['The selected name is invalid.'];
  if (body.page && typeof body.page.path !== 'string') fields['page.path'] = ['The page.path field is required.'];
  if (body.productIds !== undefined && body.productIds !== null && (!Array.isArray(body.productIds) || body.productIds.length > 50 || body.productIds.some((id) => !Number.isInteger(id) || id < 1))) fields.productIds = ['Invalid product ids.'];
  return Object.keys(fields).length ? fields : null;
}

export function createSeoModule(shopper) {
  const catalog = createCatalogModule(shopper);
  let events = [];
  let seen = new Set();
  let marketingOn = false;
  let robotsIndex = true;

  function entries(type, locale) {
    const both = (target) => ({ target, updatedAt: null, alternates: [{ locale: 'en', target }, { locale: 'ar', target }] });
    if (type === 'products') {
      return shopper.products('en').map((card) => {
        const en = { type: 'product', slug: card.slug };
        const ar = { type: 'product', slug: shopper.product(card.id, 'ar')?.slug ?? card.slug };
        return { target: locale === 'ar' ? ar : en, updatedAt: '2026-09-01T10:00:00+03:00', alternates: [{ locale: 'en', target: en }, { locale: 'ar', target: ar }] };
      });
    }
    if (type === 'categories') {
      const out = [];
      const walk = (nodes) => nodes.forEach((node) => (out.push(both(node.target)), walk(node.children ?? [])));
      walk(catalog.handle({ method: 'GET', pathname: '/categories', query: new URLSearchParams(), token: null, locale, body: null })[1].data.items);
      return out;
    }
    if (type === 'brands') {
      const slugs = [...new Set(shopper.products('en').map((card) => card.brand?.slug).filter(Boolean))];
      return slugs.map((slug) => both({ type: 'brand', slug }));
    }
    if (type === 'pages') return ['about-us', 'privacy-policy'].map((slug) => both({ type: 'page', slug }));
    if (type === 'landing_pages') return [both({ type: 'landing_page', slug: 'ramadan' })];
    return [both({ type: 'tag', slug: 'new-arrivals' })];
  }

  function sitemap(query, locale) {
    const type = query.get('type');
    const page = query.has('page') ? Number(query.get('page')) : 1;
    const perPage = query.has('perPage') ? Number(query.get('perPage')) : 1000;
    const fields = {};
    if (!SITEMAP_TYPES.includes(type)) fields.type = ['The selected type is invalid.'];
    if (!Number.isInteger(page) || page < 1) fields.page = ['The page must be at least 1.'];
    if (!Number.isInteger(perPage) || perPage < 1 || perPage > 5000) fields.perPage = ['The per page must be between 1 and 5000.'];
    if (Object.keys(fields).length) return [422, { error: { code: 'validation_failed', message: 'Please check the highlighted fields.', fields } }];
    const all = entries(type, locale);
    return [200, { data: { items: all.slice((page - 1) * perPage, page * perPage), pagination: { page, perPage, total: all.length, totalPages: Math.ceil(all.length / perPage) } } }];
  }

  return {
    handle({ method, pathname, query, token, locale, body }) {
      if (method === 'GET' && pathname === '/seo/site') return [200, { data: siteSeo(locale, robotsIndex) }];
      if (method === 'GET' && pathname === '/sitemap') return sitemap(query, locale);
      if (method === 'POST' && pathname === '/events') {
        const fields = eventErrors(body, locale);
        if (fields) return [422, { error: { code: 'validation_failed', message: locale === 'ar' ? 'يرجى مراجعة الحقول المحددة.' : 'Please check the highlighted fields.', fields } }];
        const duplicate = Boolean(body.eventId) && seen.has(body.eventId);
        if (body.eventId) seen.add(body.eventId);
        if (!duplicate) events.push({ ...body, token: token ?? null, locale });
        return [202, { data: { accepted: !duplicate } }];
      }
      return null;
    },
    /** Test controls outside /api (see the header). */
    control(method, pathname, body) {
      if (method === 'GET' && pathname === '/__events') return [200, { events }];
      if (method === 'POST' && pathname === '/__seo') {
        if (typeof body?.marketing === 'boolean') marketingOn = body.marketing;
        if (typeof body?.robotsIndex === 'boolean') robotsIndex = body.robotsIndex;
        return [200, { marketing: marketingOn, robotsIndex }];
      }
      return null;
    },
    /** Adds this phase's members to the recorded layout / home answers. */
    decorate(endpoint, data, locale) {
      if (endpoint === 'layout') return { ...data, marketing: marketingOn ? MOCK_MARKETING : NO_MARKETING };
      if (endpoint === 'home') return { ...data, seo: homeSeo(locale) };
      return data;
    },
    reset() {
      events = [];
      seen = new Set();
      marketingOn = false;
      robotsIndex = true;
    },
  };
}
