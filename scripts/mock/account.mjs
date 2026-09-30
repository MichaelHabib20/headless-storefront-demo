/**
 * Mock module: the shopper's address book and orders (needs a shopper token).
 *   GET    /addresses                    → AddressesResponse
 *   POST   /addresses                    → 201 AddressSavedResponse   (422 validation_failed with `fields`)
 *   PUT    /addresses/{id}               → AddressSavedResponse       (the edited address gets a NEW id)
 *   DELETE /addresses/{id}               → AddressesResponse          (deleting the default makes another one default)
 *   POST   /addresses/{id}/default       → AddressesResponse
 *   GET    /orders?page&perPage          → OrdersResponse             (newest first)
 *   GET    /orders/cancellation-reasons  → CancellationReasonsResponse
 *   GET    /orders/{id}                  → OrderResponse
 *   POST   /orders/{id}/cancel           → OrderResponse              (409 cannot_cancel when not `actions.canCancel`)
 *   POST   /orders/{id}/reorder          → ReorderResponse            (skips products that are not sold any more)
 * Unknown or someone else's id → 404. No session → 401.
 *
 * State lives on the shopper session (account-state.mjs), shared with the checkout module. The seeded
 * customer gets 12 orders the first time its orders are used: one in progress (can be cancelled, with a
 * timeline), one delivered (can be ordered again; one of its products is not sold any more), one picked
 * up from a branch, one cancelled, and older ones — two pages of 10. Test scaffolding only: the real
 * rules live in the backend.
 */
import { ADDRESS_FIELDS, CITIES, addressRows, addressesOf, newAddressId, orderRows, presentAddress, resetAccountCounters } from './account-state.mjs';

const TEXT = {
  en: {
    validation_failed: 'Please check the highlighted fields.',
    required: (label) => `${label} is required.`,
    cityId: 'Choose a city.',
    areaId: 'Choose an area.',
    districtId: 'Choose a district.',
    phone: 'Enter a mobile number of 11 digits.',
    not_found: 'Not found.',
    unauthenticated: 'Please start a session first.',
    cannot_cancel: 'This order can no longer be cancelled.',
    reasonId: 'Choose a reason.',
    discontinued: 'This product is no longer sold.',
    outOfStock: 'This product is out of stock.',
    status: {
      processing: 'Being prepared',
      delivered: 'Delivered',
      picked_up: 'Picked up',
      cancelled: 'Cancelled',
      returned: 'Returned',
    },
    steps: { placed: 'Order placed', confirmed: 'Confirmed', preparing: 'Being prepared', onTheWay: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' },
    lines: { subtotal: 'Subtotal', promotion: 'Weekend offer', promoCode: 'Promo code SAVE20', delivery: 'Delivery', pickup: 'Pickup from the branch', free: 'Free' },
    payment: { cash: 'Cash on delivery', card: 'Credit card', branch: 'Pay at the branch' },
    note: 'Please call me before you arrive.',
    discontinuedName: 'Baby Wipes Travel Pack',
    branch: { name: 'Nasr City branch', address: '5 Makram Ebeid St, Nasr City, Cairo' },
    reasons: ['I changed my mind', 'I ordered by mistake', 'Delivery takes too long', 'Another reason'],
  },
  ar: {
    validation_failed: 'يرجى مراجعة الحقول المحددة.',
    required: (label) => `${label} مطلوب.`,
    cityId: 'اختر المدينة.',
    areaId: 'اختر المنطقة.',
    districtId: 'اختر الحي.',
    phone: 'أدخل رقم موبايل من 11 رقماً.',
    not_found: 'غير موجود.',
    unauthenticated: 'يرجى بدء جلسة أولاً.',
    cannot_cancel: 'لم يعد من الممكن إلغاء هذا الطلب.',
    reasonId: 'اختر سبب الإلغاء.',
    discontinued: 'هذا المنتج لم يعد متاحاً للبيع.',
    outOfStock: 'هذا المنتج غير متوفر حالياً.',
    status: {
      processing: 'قيد التجهيز',
      delivered: 'تم التوصيل',
      picked_up: 'تم الاستلام',
      cancelled: 'ملغي',
      returned: 'مرتجع',
    },
    steps: { placed: 'تم استلام الطلب', confirmed: 'تم التأكيد', preparing: 'قيد التجهيز', onTheWay: 'في الطريق إليك', delivered: 'تم التوصيل', cancelled: 'ملغي' },
    lines: { subtotal: 'المجموع الفرعي', promotion: 'عرض نهاية الأسبوع', promoCode: 'كود الخصم SAVE20', delivery: 'التوصيل', pickup: 'الاستلام من الفرع', free: 'مجاناً' },
    payment: { cash: 'الدفع عند الاستلام', card: 'بطاقة ائتمان', branch: 'الدفع في الفرع' },
    note: 'من فضلك اتصل بي قبل الوصول.',
    discontinuedName: 'مناديل أطفال مبللة للسفر',
    branch: { name: 'فرع مدينة نصر', address: '5 شارع مكرم عبيد، مدينة نصر، القاهرة' },
    reasons: ['غيرت رأيي', 'طلبت بالخطأ', 'التوصيل يستغرق وقتاً طويلاً', 'سبب آخر'],
  },
};

const LOCALES = ['en', 'ar'];
const REASON_IDS = [1, 2, 3, 4];

/** Where the seeded delivery orders went (the seeded customer's default address). */
const SEEDED_ADDRESS_ROW = { id: 501, cityId: 1, areaId: 11, districtId: null, values: { street: '12 Abbas El Akkad St', building: '12' } };

/*
 * The seeded customer's orders, newest first. `items[].product` is an index in the mock catalog
 * (null: a product that is not sold any more); `discount` is a percentage off that line.
 */
const SEEDED_ORDERS = [
  {
    number: '48201',
    placedAt: '2026-09-28T09:30:00Z',
    status: 'processing',
    steps: [['placed', 'done'], ['confirmed', 'done'], ['preparing', 'current'], ['onTheWay'], ['delivered']],
    fulfilment: 'delivery',
    payment: ['cash', false],
    items: [{ product: 1, quantity: 1 }, { product: 5, quantity: 2, discount: 10 }],
    promoCode: 20,
    deliveryFee: 25,
    note: true,
    actions: { canCancel: true, canReorder: false },
  },
  {
    number: '48200',
    placedAt: '2026-09-20T12:00:00Z',
    status: 'delivered',
    steps: [['placed', 'done'], ['confirmed', 'done'], ['preparing', 'done'], ['onTheWay', 'done'], ['delivered', 'finished']],
    fulfilment: 'delivery',
    payment: ['card', true],
    items: [{ product: 0, quantity: 2, discount: 10 }, { product: 2, quantity: 1 }, { product: null, quantity: 1, unit: 45 }],
    promotion: 15,
    deliveryFee: 25,
    actions: { canCancel: false, canReorder: true },
  },
  {
    number: '48199',
    placedAt: '2026-09-15T12:00:00Z',
    status: 'picked_up',
    steps: [],
    fulfilment: 'pickup',
    payment: ['branch', false],
    items: [{ product: 3, quantity: 1 }],
    actions: { canCancel: false, canReorder: true },
  },
  {
    number: '48198',
    placedAt: '2026-09-10T12:00:00Z',
    status: 'cancelled',
    steps: [['placed', 'done'], ['cancelled', 'finished']],
    fulfilment: 'delivery',
    payment: ['cash', false],
    items: [{ product: 4, quantity: 1 }, { product: 6, quantity: 1 }],
    deliveryFee: 25,
    actions: { canCancel: false, canReorder: false },
  },
  ...Array.from({ length: 8 }, (_, i) => ({
    number: String(48197 - i),
    placedAt: `2026-08-${String(28 - i * 3).padStart(2, '0')}T12:00:00Z`,
    // one older order has a status this storefront has no style for
    status: i === 2 ? 'returned' : 'delivered',
    steps: [],
    fulfilment: 'delivery',
    payment: ['cash', false],
    items: [{ product: 7 + (i % 3), quantity: 1 + (i % 2) }],
    deliveryFee: 25,
    actions: { canCancel: false, canReorder: true },
  })),
];

const ACTIVE = new Set(['processing']);

export function createAccountModule(shopper) {
  const catalog = (locale) => shopper.products(locale);

  function status(code, locale) {
    return { code, label: TEXT[locale].status[code] ?? code, active: ACTIVE.has(code) };
  }

  function timeline(steps, locale) {
    // 'done' → passed, 'current' → where the order is now, 'finished' → the last step, reached
    return steps.map(([step, state]) => ({
      label: TEXT[locale].steps[step],
      done: state === 'done' || state === 'finished',
      current: state === 'current' || state === 'finished',
    }));
  }

  function buildOrder(spec, locale) {
    const t = TEXT[locale];
    let subtotal = 0;
    const items = spec.items.map(({ product, quantity, discount = 0, unit }) => {
      const card = product === null ? null : catalog(locale)[product];
      const full = (card?.price?.amount ?? unit) * quantity;
      const paid = (full * (100 - discount)) / 100;
      subtotal += paid;
      return {
        name: card?.name ?? t.discontinuedName,
        image: card?.image ?? null,
        target: card?.target ?? null,
        quantity,
        lineTotal: shopper.money(paid, locale),
        compareAt: discount ? shopper.money(full, locale) : null,
      };
    });
    const lines = [{ kind: 'subtotal', label: t.lines.subtotal, amount: shopper.total(subtotal, locale), text: null }];
    let total = subtotal;
    if (spec.promotion) {
      lines.push({ kind: 'promotion_discount', label: t.lines.promotion, amount: shopper.total(-spec.promotion, locale), text: null });
      total -= spec.promotion;
    }
    if (spec.promoCode) {
      lines.push({ kind: 'promo_code', label: t.lines.promoCode, amount: shopper.total(-spec.promoCode, locale), text: null });
      total -= spec.promoCode;
    }
    if (spec.fulfilment === 'pickup') {
      lines.push({ kind: 'delivery', label: t.lines.pickup, amount: null, text: t.lines.free });
    } else {
      lines.push({ kind: 'delivery', label: t.lines.delivery, amount: shopper.total(spec.deliveryFee, locale), text: null });
      total += spec.deliveryFee;
    }
    const [method, online] = spec.payment;
    return {
      id: `mock-order-${spec.number}`,
      number: spec.number,
      placedAt: new Date(spec.placedAt).toISOString(),
      status: status(spec.status, locale),
      timeline: timeline(spec.steps, locale),
      fulfilment:
        spec.fulfilment === 'pickup'
          ? { type: 'pickup', address: null, branch: { id: 3, name: t.branch.name, address: t.branch.address, phone: '0222222222', mapUrl: 'https://maps.example.com/?q=nasr-city-branch' } }
          : { type: 'delivery', address: presentAddress({ ...SEEDED_ADDRESS_ROW, isDefault: false }, locale).formatted, branch: null },
      payment: { method: t.payment[method], online },
      items,
      totals: { lines, total: shopper.total(total, locale) },
      note: spec.note ? t.note : null,
      actions: { ...spec.actions },
    };
  }

  /** The session's orders; the seeded customer's history is added the first time it is used. */
  function ordersOf(session) {
    const rows = orderRows(session);
    if (!session.isGuest && !session.accountOrdersSeeded) {
      session.accountOrdersSeeded = true;
      // older than anything placed in this session: they go after it
      for (const spec of SEEDED_ORDERS) rows.push({ en: buildOrder(spec, 'en'), ar: buildOrder(spec, 'ar') });
    }
    return rows;
  }

  function summary(order) {
    const { id, number, placedAt, status: orderStatus, items, totals } = order;
    return { id, number, placedAt, status: orderStatus, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), total: totals.total };
  }

  /** Required location levels and required fields, like the backend's address validation. */
  function validateAddress(body, locale) {
    const t = TEXT[locale];
    const fields = {};
    const city = CITIES.find((c) => c.id === body?.cityId);
    if (!city) fields.cityId = [t.cityId];
    const area = city?.areas.find((a) => a.id === body?.areaId);
    if (city && city.areas.length && !area) fields.areaId = [t.areaId];
    if (area && area.districts.length && !area.districts.some((d) => d.id === body?.districtId)) fields.districtId = [t.districtId];
    const values = body?.values && typeof body.values === 'object' ? body.values : {};
    for (const field of ADDRESS_FIELDS) {
      const value = typeof values[field.name] === 'string' ? values[field.name].trim() : '';
      if (field.required && !value) fields[field.name] = [t.required(field.label[locale])];
      else if (field.kind === 'phone' && value && !/^\d{11}$/.test(value)) fields[field.name] = [t.phone];
    }
    if (Object.keys(fields).length) return { fields };
    const clean = Object.fromEntries(ADDRESS_FIELDS.map((field) => [field.name, typeof values[field.name] === 'string' && values[field.name].trim() ? values[field.name].trim() : null]));
    return { row: { cityId: city.id, areaId: area?.id ?? null, districtId: body.districtId ?? null, values: clean } };
  }

  function makeDefault(rows, id) {
    for (const row of rows) row.isDefault = row.id === id;
  }

  function handle({ method, pathname, query, token, locale, body }) {
    if (!/^\/(addresses|orders)(\/|$)/.test(pathname)) return null;
    const t = TEXT[locale];
    const error = (httpStatus, code, extra = {}) => [httpStatus, { error: { code, message: t[code], ...extra } }];
    const session = shopper.session(token);
    if (!session) return error(401, 'unauthenticated');

    // address book
    const rows = addressRows(session);
    const book = () => ({ data: { items: addressesOf(session, locale) } });
    if (pathname === '/addresses' && method === 'GET') return [200, book()];
    if (pathname === '/addresses' && method === 'POST') {
      const { fields, row } = validateAddress(body, locale);
      if (fields) return error(422, 'validation_failed', { fields });
      const saved = { id: newAddressId(), isDefault: false, ...row };
      rows.push(saved);
      if (body.isDefault === true || rows.length === 1) makeDefault(rows, saved.id);
      return [201, { data: { address: presentAddress(saved, locale), items: addressesOf(session, locale) } }];
    }
    const addressMatch = pathname.match(/^\/addresses\/(\d+)(\/default)?$/);
    if (addressMatch) {
      const index = rows.findIndex((row) => row.id === Number(addressMatch[1]));
      if (index < 0) return error(404, 'not_found');
      const row = rows[index];
      if (addressMatch[2] && method === 'POST') {
        makeDefault(rows, row.id);
        return [200, book()];
      }
      if (!addressMatch[2] && method === 'PUT') {
        const { fields, row: changes } = validateAddress(body, locale);
        if (fields) return error(422, 'validation_failed', { fields });
        // like the backend: an edited address is stored as a new one with a new id
        Object.assign(row, changes, { id: newAddressId() });
        if (body.isDefault === true) makeDefault(rows, row.id);
        return [200, { data: { address: presentAddress(row, locale), items: addressesOf(session, locale) } }];
      }
      if (!addressMatch[2] && method === 'DELETE') {
        rows.splice(index, 1);
        if (row.isDefault && rows.length) makeDefault(rows, rows[0].id);
        return [200, book()];
      }
      return error(404, 'not_found');
    }

    // orders
    if (pathname === '/orders' && method === 'GET') {
      const all = ordersOf(session);
      const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 20) || 20));
      const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
      const items = all.slice((page - 1) * perPage, page * perPage).map((row) => summary(row[locale]));
      return [200, { data: { items, pagination: { page, perPage, total: all.length, totalPages: Math.ceil(all.length / perPage) } } }];
    }
    if (pathname === '/orders/cancellation-reasons' && method === 'GET') {
      return [200, { data: { items: REASON_IDS.map((id, i) => ({ id, text: t.reasons[i] })) } }];
    }
    const orderMatch = pathname.match(/^\/orders\/([^/]+)(\/cancel|\/reorder)?$/);
    if (!orderMatch) return error(404, 'not_found');
    const row = ordersOf(session).find((entry) => entry.en.id === decodeURIComponent(orderMatch[1]));
    if (!row) return error(404, 'not_found');

    if (!orderMatch[2] && method === 'GET') return [200, { data: row[locale] }];
    if (orderMatch[2] === '/cancel' && method === 'POST') {
      if (!row.en.actions.canCancel) return error(409, 'cannot_cancel');
      if (!REASON_IDS.includes(body?.reasonId)) return error(422, 'validation_failed', { fields: { reasonId: [t.reasonId] } });
      for (const lang of LOCALES) {
        const order = row[lang];
        order.status = status('cancelled', lang);
        order.timeline = timeline([['placed', 'done'], ['cancelled', 'finished']], lang);
        order.actions = { canCancel: false, canReorder: false };
      }
      return [200, { data: row[locale] }];
    }
    if (orderMatch[2] === '/reorder' && method === 'POST') {
      const skipped = [];
      row.en.items.forEach((item, i) => {
        const name = row[locale].items[i].name;
        const product = item.target ? catalog('en').find((card) => card.target.slug === item.target.slug) : null;
        if (!product) return skipped.push({ name, reason: t.discontinued });
        if (!product.purchase.canAddToCart) return skipped.push({ name, reason: t.outOfStock });
        const max = product.purchase.maxQuantity ?? Infinity;
        session.cart.set(product.id, Math.min(max, (session.cart.get(product.id) ?? 0) + item.quantity));
      });
      return [200, { data: { cart: shopper.cartOf(session, locale), skipped } }];
    }
    return error(404, 'not_found');
  }

  return {
    handle,
    reset() {
      resetAccountCounters();
    },
  };
}
