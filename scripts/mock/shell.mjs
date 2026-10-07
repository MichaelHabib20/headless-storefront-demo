/**
 * Mock module: the site shell (contract: the shell keys of `Layout`, `Me.area`, `PUT /me/area`, 503).
 *   GET  /layout   → the recorded layout with the shell keys of the current mode (see `shellKeys`)
 *   GET  /me       → the shopper store's answer + `area` when multi-inventory is on
 *   PUT  /me/area  → MeResponse | 401 | 422 validation_failed (an area the store doesn't serve)
 * Modes (POST /__mode, combined with the server's own `fail` / `delayMs`):
 *   {"multiInventory": true}  → Layout.areaSelection (required) + Me.area
 *   {"maintenance": true}     → every API call answers 503 store_unavailable with the merchant's text
 *   {"banners": true}         → Layout.topBanner + Layout.floatingBanner
 *   {"storeClosed": true}     → Layout.storeStatus.acceptingOrders false
 * The default (no mode) is what staging has: app banner on, default bottom nav, legal pages, no
 * banners, one inventory, store open. `scripts/build-shell-fixtures.mjs` writes these keys into the
 * recorded layout fixtures.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CITIES, UNDELIVERABLE_AREA_ID } from './account-state.mjs';

const MAINTENANCE = { en: 'We are upgrading — back shortly.', ar: 'نقوم بالتحديث — نعود قريباً' };
const AREA_ERROR = { en: 'This area is not available. Please choose another one.', ar: 'هذه المنطقة غير متاحة. يرجى اختيار منطقة أخرى.' };
const VALIDATION = { en: 'Please check the highlighted fields.', ar: 'يرجى مراجعة الحقول المحددة.' };
const UNAUTHENTICATED = { en: 'Please start a session first.', ar: 'يرجى بدء جلسة أولاً.' };

const freshMode = () => ({ multiInventory: false, maintenance: false, banners: false, storeClosed: false });

const item = (id, label, icon, target = null, badge = null) => ({ id, label, icon, target, badge });

/** What the backend's MobileNav answers with staging's settings (no BOTTOM_SHEET_CONFIGURATIONS). */
function mobileNav(locale, { multiInventory }) {
  const ar = locale === 'ar';
  const more = [
    // enable_prescription on staging: the item opens the storefront's prescriptions page (no Target)
    item('prescriptions', ar ? 'الوصفات الطبية' : 'Prescription', 'receipt_long'),
    item('orders', ar ? 'طلباتي' : 'Orders', 'shopping_bag'),
    item('wishlist', ar ? 'المفضلة' : 'Wishlist', 'favorite', null, 'wishlist'),
    ...(multiInventory ? [item('area', ar ? 'المنطقة' : 'Area', 'location_on')] : []),
    item('menu_button_1', ar ? 'فروعنا' : 'Our Branches', 'https://cdn.supercommerce.io/supercommerce-demo/uploads/store-1729685182.png', { type: 'page', slug: 'branches' }),
    item('compare', ar ? 'مقارنة' : 'Compare', 'compare_arrows', null, 'compare'),
    item('language', ar ? 'English' : 'عربي', 'language'),
  ];
  return {
    items: [
      item('home', ar ? 'الرئيسية' : 'Home', 'home', { type: 'home' }),
      item('categories', ar ? 'الأقسام' : 'Categories', 'apps'),
      item('deals', ar ? 'العروض' : 'Deals', 'local_offer', { type: 'deals' }),
      item('cart', ar ? 'السلة' : 'Cart', 'shopping_cart', null, 'cart'),
      item('more', ar ? 'المزيد' : 'More', 'more_horiz'),
    ],
    more: {
      title: ar ? 'المزيد' : 'More',
      welcomeTitle: ar ? 'مرحبا بك في صيدليات سيف!' : 'Welcome to Seif Pharmacies!',
      welcomeText: ar ? 'تسجيل الدخول لتجربة سلسة.' : 'Login for a seamless experience.',
      items: more,
    },
  };
}

function banner(locale, index) {
  const home = JSON.parse(fs.readFileSync(path.resolve(`src/test/fixtures/v3/home.${locale}.json`), 'utf8')).data;
  const promo = home.promoBanners[index] ?? home.promoBanners[0];
  return { id: promo.id + 1000 * (index + 1), image: promo.image, title: null, target: index === 0 ? { type: 'deals' } : { type: 'landing_page', slug: 'summer-sale' } };
}

/** The shell keys of `Layout` in a mode (the default mode is staging's). */
export function shellKeys(locale, mode = freshMode()) {
  const ar = locale === 'ar';
  return {
    legal: {
      // `legal`: the backend flags legal pages; the storefront links them at the root (/privacy-policy)
      privacy: { type: 'page', slug: 'privacy-policy', legal: 'privacy' },
      terms: { type: 'page', slug: 'terms-and-conditions', legal: 'terms' },
      cookies: { type: 'page', slug: 'cookie-policy', legal: 'cookies' },
    },
    appBanner: {
      title: null,
      text: ar ? 'حمل التطبيق الآن' : 'Download App Now',
      links: {
        android: 'https://play.google.com/store/apps/details?id=com.awfar.seif&hl=en&pli=1',
        ios: 'https://apps.apple.com/eg/app/seif-pharmacies-%D8%B5%D9%8A%D8%AF%D9%84%D9%8A%D8%A9-%D8%B3%D9%8A%D9%81/id6463644571',
      },
    },
    topBanner: mode.banners ? banner(locale, 0) : null,
    floatingBanner: mode.banners ? banner(locale, 1) : null,
    mobileNav: mobileNav(locale, mode),
    areaSelection: mode.multiInventory
      ? { required: true, label: ar ? 'التوصيل إلى' : 'Deliver to', prompt: ar ? 'اختر المحافظة والمنطقة لعرض المتاح بالقرب منك.' : 'Choose your Governorate and City to see what is available near you.' }
      : null,
    storeStatus: mode.storeClosed
      ? { acceptingOrders: false, message: ar ? 'نستقبل الطلبات من جديد غدًا الساعة 9 صباحًا.' : 'We take orders again tomorrow at 9 am.' }
      : { acceptingOrders: true, message: null },
  };
}

/** `Me.area` of a session: the area it chose ({id, name, city}) or null. */
function areaOf(session, locale) {
  if (!session?.areaId) return null;
  for (const city of CITIES) {
    const area = city.areas.find((option) => option.id === session.areaId);
    if (area) return { id: area.id, name: area.name[locale], city: city.name[locale] };
  }
  return null;
}

/** The areas the store serves: every listed area but the one it doesn't deliver to. */
function served(areaId) {
  return areaId !== UNDELIVERABLE_AREA_ID && CITIES.some((city) => city.areas.some((area) => area.id === areaId));
}

export function createShellModule(shopper) {
  let mode = freshMode();

  return {
    /** POST /__mode: the shell switches (other keys belong to the server). */
    mode(body) {
      for (const key of Object.keys(freshMode())) if (key in (body ?? {})) mode[key] = Boolean(body[key]);
      return { ...mode };
    },
    /** Asked before the recorded layout / home and before the shopper store. */
    intercept(request) {
      const { method, pathname, locale } = request;
      if (mode.maintenance) return [503, { error: { code: 'store_unavailable', message: MAINTENANCE[locale] } }];
      if (method === 'GET' && pathname === '/me' && mode.multiInventory) {
        const [status, body] = shopper.handle(request);
        if (status === 200) body.data.area = body.data.authenticated ? areaOf(shopper.session(request.token), locale) : null;
        return [status, body];
      }
      return null;
    },
    /** The recorded layout gets the shell keys of the current mode (like the other modules' additions). */
    decorate(endpoint, data, locale) {
      return endpoint === 'layout' ? { ...data, ...shellKeys(locale, mode) } : data;
    },
    handle(request) {
      const { method, pathname, token, locale, body } = request;
      if (!(method === 'PUT' && pathname === '/me/area')) return null;
      const session = shopper.session(token);
      if (!session) return [401, { error: { code: 'unauthenticated', message: UNAUTHENTICATED[locale] } }];
      const areaId = body?.areaId;
      if (!Number.isInteger(areaId) || areaId < 1 || !served(areaId)) {
        return [422, { error: { code: 'validation_failed', message: VALIDATION[locale], fields: { areaId: [AREA_ERROR[locale]] } } }];
      }
      session.areaId = areaId;
      const [, me] = shopper.handle({ ...request, method: 'GET', pathname: '/me' });
      me.data.area = areaOf(session, locale);
      return [200, me];
    },
    reset() {
      mode = freshMode();
    },
  };
}
