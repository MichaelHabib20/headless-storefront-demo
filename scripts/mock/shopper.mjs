/**
 * In-memory shopper state for the mock v3 API (e2e + local development).
 * Follows the contract's rules closely enough to exercise every UI state; the real
 * business rules live in the backend — this is test scaffolding only.
 */
import fs from 'node:fs';
import path from 'node:path';

const FIXTURES = path.resolve('src/test/fixtures/v3');
const MINIMUM_ORDER = 300;
const COMPARE_MAX = 4;
const CURRENCY = 'EGP';

const MESSAGES = {
  en: {
    empty_cart: 'Your cart is empty.',
    minimum_order: (remaining) => `Add EGP ${remaining} more to reach the minimum order.`,
    unavailable_items: 'Remove or update the items that are not available.',
    out_of_stock: 'Out of stock',
    exceeds_limit: (max) => `You can buy up to ${max} of this item.`,
    unauthenticated: 'Please start a session first.',
    not_found: 'Not found.',
    compare_full: `You can compare up to ${COMPARE_MAX} products.`,
    quantity_not_allowed: 'This quantity is not allowed.',
  },
  ar: {
    empty_cart: 'سلة التسوق فارغة.',
    minimum_order: (remaining) => `أضف ${remaining} ج.م للوصول للحد الأدنى للطلب.`,
    unavailable_items: 'احذف أو عدّل المنتجات غير المتوفرة.',
    out_of_stock: 'غير متوفر',
    exceeds_limit: (max) => `يمكنك شراء ${max} قطع كحد أقصى من هذا المنتج.`,
    unauthenticated: 'يرجى بدء جلسة أولاً.',
    not_found: 'غير موجود.',
    compare_full: `يمكنك مقارنة ${COMPARE_MAX} منتجات كحد أقصى.`,
    quantity_not_allowed: 'هذه الكمية غير مسموح بها.',
  },
};

const NOTIFICATIONS = [
  { id: 901, title: { en: 'Your order is on its way', ar: 'طلبك في الطريق' }, body: { en: 'Order #10231 left our pharmacy and will arrive today.', ar: 'خرج الطلب رقم 10231 من الصيدلية وسيصل اليوم.' }, target: null, daysAgo: 0, broadcast: false },
  { id: 902, title: { en: 'Baby care week', ar: 'أسبوع العناية بالطفل' }, body: { en: 'Up to 20% off selected baby care products.', ar: 'خصم حتى 20٪ على منتجات مختارة للعناية بالطفل.' }, target: { type: 'list', slug: null, id: 125 }, daysAgo: 1, broadcast: true },
  { id: 903, title: { en: 'Upload your prescription', ar: 'ارفع روشتتك' }, body: { en: 'We prepare your medicines and deliver them to your door.', ar: 'نجهز أدويتك ونوصلها لباب بيتك.' }, target: { type: 'form', slug: 'prescriptions' }, daysAgo: 3, broadcast: true },
];
for (let i = 0; i < 22; i++) {
  NOTIFICATIONS.push({ id: 910 + i, title: { en: `Offer of the day #${i + 1}`, ar: `عرض اليوم رقم ${i + 1}` }, body: { en: 'New deals are waiting for you.', ar: 'عروض جديدة في انتظارك.' }, target: { type: 'deals' }, daysAgo: 4 + i, broadcast: true });
}

function loadCatalog() {
  const catalog = { en: new Map(), ar: new Map() };
  for (const locale of ['en', 'ar']) {
    const home = JSON.parse(fs.readFileSync(path.join(FIXTURES, `home.${locale}.json`), 'utf8')).data;
    for (const section of home.sections) for (const product of section.products) catalog[locale].set(product.id, product);
  }
  return catalog;
}

const money = (amount) => ({ amount: Math.round(amount * 100) / 100, currency: CURRENCY });

export function createShopperStore({ now = () => new Date('2026-09-29T10:00:00Z') } = {}) {
  const catalog = loadCatalog();
  const productIds = [...catalog.en.keys()];
  const sessions = new Map(); // token → state
  let guestCounter = 0;

  function newState(isGuest, firstName = null) {
    return { isGuest, firstName, cart: new Map(), wishlist: [], compare: [], read: new Set() };
  }

  /** The seeded signed-in customer used by tests: "Bearer test-customer". */
  function seedCustomer() {
    const state = newState(false, 'Test');
    state.cart.set(productIds[0], 2);
    state.cart.set(productIds[1], 1);
    state.wishlist = [productIds[2], productIds[3], productIds[4]];
    state.compare = [productIds[0], productIds[2]];
    state.read.add(903);
    return state;
  }
  sessions.set('test-customer', seedCustomer());

  const product = (id, locale) => catalog[locale].get(id) ?? null;

  function cart(state, locale) {
    const t = MESSAGES[locale];
    const items = [];
    for (const [id, quantity] of state.cart) {
      const card = product(id, locale);
      if (!card) continue;
      const max = card.purchase.maxQuantity;
      let status = 'available';
      let message = null;
      if (!card.inStock) [status, message] = ['out_of_stock', t.out_of_stock];
      else if (max !== null && quantity > max) [status, message] = ['exceeds_limit', t.exceeds_limit(max)];
      const unit = card.price ?? { currency: CURRENCY, amount: 0, compareAt: null, discountPercent: null };
      items.push({
        product: card,
        quantity,
        quantityStep: 1,
        unitPrice: unit,
        lineTotal: money(unit.amount * quantity),
        availability: { status, message, minQuantity: card.purchase.minQuantity, maxQuantity: max },
      });
    }
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal.amount, 0);
    const remaining = Math.max(0, MINIMUM_ORDER - subtotal);
    const blockers = [];
    if (!items.length) blockers.push({ code: 'empty_cart', message: t.empty_cart });
    else {
      if (remaining > 0) blockers.push({ code: 'minimum_order', message: t.minimum_order(remaining) });
      if (items.some((item) => item.availability.status !== 'available')) blockers.push({ code: 'unavailable_items', message: t.unavailable_items });
    }
    return {
      items,
      summary: { itemCount: items.reduce((n, item) => n + item.quantity, 0), subtotal: money(subtotal), discount: null, total: money(subtotal) },
      checkout: { allowed: blockers.length === 0, blockers, minimumOrder: { amount: money(MINIMUM_ORDER), remaining: money(remaining) } },
      requiresPrescription: items.some((item) => item.product.requiresPrescription),
    };
  }

  const listState = (ids, maxItems) => ({ count: ids.length, productIds: [...ids], maxItems });

  function page(all, pageNumber, perPage) {
    const total = all.length;
    const totalPages = Math.ceil(total / perPage);
    return { slice: all.slice((pageNumber - 1) * perPage, pageNumber * perPage), pagination: { page: pageNumber, perPage, total, totalPages } };
  }

  function notificationsFor(state, locale) {
    return NOTIFICATIONS.filter((n) => n.broadcast || !state.isGuest).map((n) => ({
      id: n.id,
      title: n.title[locale],
      body: n.body[locale],
      image: null,
      target: n.target,
      createdAt: new Date(now().getTime() - n.daysAgo * 86400000).toISOString(),
      read: state.read.has(n.id),
    }));
  }

  function me(state) {
    if (!state) {
      return { authenticated: false, isGuest: false, customer: null, counts: { cart: 0, wishlist: 0, compare: 0, unreadNotifications: 0 }, cartQuantities: {}, wishlistProductIds: [], compareProductIds: [] };
    }
    const unread = notificationsFor(state, 'en').filter((n) => !n.read).length;
    return {
      authenticated: true,
      isGuest: state.isGuest,
      customer: state.firstName ? { firstName: state.firstName } : null,
      counts: { cart: state.cart.size, wishlist: state.wishlist.length, compare: state.compare.length, unreadNotifications: unread },
      cartQuantities: Object.fromEntries([...state.cart].map(([id, q]) => [String(id), q])),
      wishlistProductIds: [...state.wishlist],
      compareProductIds: [...state.compare],
    };
  }

  /** Returns [status, body]. */
  function handle({ method, pathname, query, token, locale, body }) {
    const t = MESSAGES[locale];
    const error = (status, code, extra = {}) => [status, { error: { code, message: t[code] ?? code, ...extra } }];
    const state = token ? sessions.get(token) : null;

    if (method === 'POST' && pathname === '/session/guest') {
      const newToken = `guest-${++guestCounter}`;
      sessions.set(newToken, newState(true));
      return [201, { data: { token: newToken, isGuest: true } }];
    }
    if (method === 'GET' && pathname === '/me') return [200, { data: me(token && !state ? null : state) }];

    if (!state) return error(401, 'unauthenticated');

    const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 20)));
    const pageNumber = Math.max(1, Number(query.get('page') ?? 1));
    const itemMatch = pathname.match(/^\/(cart|wishlist|compare)\/items\/(\d+)(\/move-to-cart)?$/);
    const productId = itemMatch ? Number(itemMatch[2]) : null;
    if (itemMatch && !product(productId, locale)) return error(404, 'not_found');

    // cart
    if (pathname === '/cart' && method === 'GET') return [200, { data: cart(state, locale) }];
    if (pathname === '/cart' && method === 'DELETE') {
      state.cart.clear();
      return [200, { data: cart(state, locale) }];
    }
    if (itemMatch?.[1] === 'cart' && method === 'PUT') {
      const quantity = Number(body?.quantity);
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > 200) return error(422, 'validation_failed', { fields: { quantity: [t.quantity_not_allowed] } });
      if (quantity === 0) state.cart.delete(productId);
      else state.cart.set(productId, quantity);
      return [200, { data: cart(state, locale) }];
    }
    if (itemMatch?.[1] === 'cart' && method === 'DELETE') {
      state.cart.delete(productId);
      return [200, { data: cart(state, locale) }];
    }

    // wishlist
    if (pathname === '/wishlist' && method === 'GET') {
      const { slice, pagination } = page([...state.wishlist].reverse(), pageNumber, perPage);
      return [200, { data: { items: slice.map((id) => product(id, locale)).filter(Boolean), pagination } }];
    }
    if (itemMatch?.[1] === 'wishlist' && itemMatch[3] && method === 'POST') {
      state.wishlist = state.wishlist.filter((id) => id !== productId);
      state.cart.set(productId, (state.cart.get(productId) ?? 0) + 1);
      return [200, { data: { cart: cart(state, locale), wishlist: listState(state.wishlist, null) } }];
    }
    if (itemMatch?.[1] === 'wishlist' && method === 'PUT') {
      if (!state.wishlist.includes(productId)) state.wishlist.push(productId);
      return [200, { data: listState(state.wishlist, null) }];
    }
    if (itemMatch?.[1] === 'wishlist' && method === 'DELETE') {
      state.wishlist = state.wishlist.filter((id) => id !== productId);
      return [200, { data: listState(state.wishlist, null) }];
    }

    // compare
    if (pathname === '/compare' && method === 'GET') {
      const products = state.compare.map((id) => product(id, locale)).filter(Boolean);
      const attributes = [
        { name: locale === 'ar' ? 'الماركة' : 'Brand', values: products.map((p) => p.brand?.name ?? null) },
        { name: locale === 'ar' ? 'النوع' : 'Type', values: products.map(() => 'BEAUTY STORES') },
        { name: locale === 'ar' ? 'الخامة' : 'Material', values: products.map((p, i) => (i === 0 ? null : `Ref ${p.id}`)) },
      ];
      return [200, { data: { products, attributes, maxItems: COMPARE_MAX } }];
    }
    if (itemMatch?.[1] === 'compare' && method === 'PUT') {
      if (!state.compare.includes(productId)) {
        if (state.compare.length >= COMPARE_MAX) return error(409, 'compare_full');
        state.compare.push(productId);
      }
      return [200, { data: listState(state.compare, COMPARE_MAX) }];
    }
    if (itemMatch?.[1] === 'compare' && method === 'DELETE') {
      state.compare = state.compare.filter((id) => id !== productId);
      return [200, { data: listState(state.compare, COMPARE_MAX) }];
    }

    // notifications
    if (pathname === '/notifications' && method === 'GET') {
      const all = notificationsFor(state, locale);
      const { slice, pagination } = page(all, pageNumber, perPage);
      return [200, { data: { items: slice, pagination, unreadCount: all.filter((n) => !n.read).length } }];
    }
    const readMatch = pathname.match(/^\/notifications\/(\d+)\/read$/);
    if (readMatch && method === 'POST') {
      const id = Number(readMatch[1]);
      if (!notificationsFor(state, locale).some((n) => n.id === id)) return error(404, 'not_found');
      state.read.add(id);
      return [200, { data: { unreadCount: notificationsFor(state, locale).filter((n) => !n.read).length } }];
    }
    if (pathname === '/notifications/read-all' && method === 'POST') {
      for (const n of notificationsFor(state, locale)) state.read.add(n.id);
      return [200, { data: { unreadCount: 0 } }];
    }

    return error(404, 'not_found');
  }

  return {
    handle,
    reset() {
      sessions.clear();
      guestCounter = 0;
      sessions.set('test-customer', seedCustomer());
    },
  };
}
