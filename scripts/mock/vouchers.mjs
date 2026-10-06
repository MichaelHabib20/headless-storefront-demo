/**
 * Mock module: the customer's vouchers (contract: Vouchers, Voucher, VoucherAddedResponse,
 * Checkout.promo.suggestions; design: phase-b-v3-design.md §2). Customer token only (guests → 401);
 * 404 while the store has vouchers and cashback off.
 *   GET  /vouchers         → VouchersResponse
 *   POST /vouchers {code}  → 201 VoucherAddedResponse | 422 validation_failed (fields.code)
 * The seeded customer ("Bearer test-customer") has SAVE10 and FREEDEL (active: the mock checkout applies
 * them), ONCE (used) and OLD (expired). The store also has WELCOME20 to add. The checkout module offers the
 * active codes as `promo.suggestions`.
 * Off by default, as on staging. Switches: POST /__mode {"vouchers": {"on": true | false}}.
 * Test scaffolding only: the real rules are the backend's.
 */

const TEXT = {
  en: {
    title: 'My vouchers',
    hint: 'Use an active voucher by entering its code at checkout.',
    status: { active: 'Active', used: 'Used', expired: 'Expired' },
    added: 'The voucher was added to your account.',
    invalid: 'This voucher code is not valid.',
    alreadyAdded: 'You have already added this voucher.',
    empty: 'Enter a voucher code.',
    errors: { not_found: 'Not found.', unauthenticated: 'Please start a session first.', validation_failed: 'Please check the highlighted fields.' },
    validUntil: (d) => `Valid until ${d}`,
    expiredOn: (d) => `Expired on ${d}`,
    dates: { '2026-12-31': '31 Dec 2026', '2027-03-31': '31 Mar 2027', '2026-11-30': '30 Nov 2026', '2026-06-30': '30 Jun 2026' },
    vouchers: {
      SAVE10: { benefit: '10% off', minimumOrder: null, detail: null },
      FREEDEL: { benefit: 'Free delivery', minimumOrder: 'On orders from 200 EGP', detail: 'Cashback from order #48200' },
      ONCE: { benefit: '50 EGP off', minimumOrder: null, detail: null },
      OLD: { benefit: '30 EGP off', minimumOrder: null, detail: null },
      WELCOME20: { benefit: '20% off, up to 100 EGP', minimumOrder: null, detail: null },
    },
  },
  ar: {
    title: 'قسائمي',
    hint: 'استخدم القسيمة النشطة بإدخال كودها عند إتمام الطلب.',
    status: { active: 'نشطة', used: 'مستخدمة', expired: 'منتهية' },
    added: 'تمت إضافة القسيمة إلى حسابك.',
    invalid: 'كود القسيمة غير صالح.',
    alreadyAdded: 'لقد أضفت هذه القسيمة من قبل.',
    empty: 'أدخل كود القسيمة.',
    errors: { not_found: 'غير موجود.', unauthenticated: 'يرجى بدء جلسة أولاً.', validation_failed: 'يرجى مراجعة الحقول المحددة.' },
    validUntil: (d) => `صالحة حتى ${d}`,
    expiredOn: (d) => `انتهت في ${d}`,
    dates: { '2026-12-31': '31 ديسمبر 2026', '2027-03-31': '31 مارس 2027', '2026-11-30': '30 نوفمبر 2026', '2026-06-30': '30 يونيو 2026' },
    vouchers: {
      SAVE10: { benefit: 'خصم 10%', minimumOrder: null, detail: null },
      FREEDEL: { benefit: 'توصيل مجاني', minimumOrder: 'للطلبات من 200 جنية', detail: 'استرداد نقدي من الطلب رقم 48200' },
      ONCE: { benefit: 'خصم 50 جنية', minimumOrder: null, detail: null },
      OLD: { benefit: 'خصم 30 جنية', minimumOrder: null, detail: null },
      WELCOME20: { benefit: 'خصم 20%، بحد أقصى 100 جنية', minimumOrder: null, detail: null },
    },
  },
};

/** The store's voucher codes: id, status for the seeded customer, expiry, credit. */
const CODES = {
  SAVE10: { id: '11', status: 'active', expires: '2026-12-31', credit: null },
  FREEDEL: { id: '12', status: 'active', expires: '2026-11-30', credit: { total: 100, remaining: 60 } },
  ONCE: { id: '13', status: 'used', expires: '2027-03-31', credit: null },
  OLD: { id: '14', status: 'expired', expires: '2026-06-30', credit: null },
  WELCOME20: { id: '15', status: 'active', expires: '2027-03-31', credit: null },
};
const SEEDED = ['SAVE10', 'FREEDEL', 'ONCE', 'OLD'];
const ORDER = { active: 0, used: 1, expired: 2 };

const STATES = new WeakMap();

/** The vouchers of the shopper store, shared with the checkout module. */
export function vouchersState(shopper) {
  let state = STATES.get(shopper);
  if (state) return state;
  let mode = { on: false };
  const codesOf = (session) => {
    if (session.vouchers === undefined) session.vouchers = session === shopper.session('test-customer') ? [...SEEDED] : [];
    return session.vouchers;
  };
  state = {
    get on() {
      return mode.on;
    },
    mode: () => ({ ...mode }),
    setMode(input) {
      mode = { ...mode, ...input };
    },
    reset() {
      mode = { on: false };
    },
    codesOf,
    /** `Voucher` rows in the contract's order. */
    list(session, locale, money) {
      const t = TEXT[locale];
      return codesOf(session)
        .map((code) => {
          const row = CODES[code];
          const text = t.vouchers[code];
          return {
            id: row.id,
            code,
            status: row.status,
            statusLabel: t.status[row.status],
            benefit: text.benefit,
            minimumOrder: text.minimumOrder,
            credit: row.credit ? { total: money(row.credit.total, locale), remaining: money(row.credit.remaining, locale) } : null,
            detail: text.detail,
            expiresAt: `${row.expires}T23:59:59+02:00`,
            expiry: (row.status === 'expired' ? t.expiredOn : t.validUntil)(t.dates[row.expires]),
          };
        })
        .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === 'active' ? 1 : -1) * a.expiresAt.localeCompare(b.expiresAt));
    },
    /** Checkout `promo.suggestions`: the active codes, without the one applied. */
    suggestions(session, locale, applied) {
      if (!mode.on || !session || session.isGuest) return undefined;
      return state
        .list(session, locale, (n) => n)
        .filter((voucher) => voucher.status === 'active' && voucher.code !== applied?.toUpperCase())
        .map((voucher) => ({ code: voucher.code, benefit: voucher.benefit }));
    },
  };
  STATES.set(shopper, state);
  return state;
}

export function createVouchersModule(shopper) {
  const state = vouchersState(shopper);
  const error = (status, code, locale, fields) => [status, { error: { code, message: TEXT[locale].errors[code] ?? code, ...(fields ? { fields } : {}) } }];

  function page(session, locale) {
    const t = TEXT[locale];
    const items = state.list(session, locale, shopper.total);
    return {
      title: t.title,
      hint: t.hint,
      canAdd: true,
      statuses: ['active', 'used', 'expired'].map((status) => ({ status, label: t.status[status], count: items.filter((v) => v.status === status).length })),
      items,
    };
  }

  return {
    handle({ method, pathname, token, locale, body }) {
      if (pathname !== '/vouchers') return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!state.on) return error(404, 'not_found', locale);
      if (method === 'GET') return [200, { data: page(session, locale) }];
      if (method !== 'POST') return error(404, 'not_found', locale);

      const t = TEXT[locale];
      const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
      if (!code) return error(422, 'validation_failed', locale, { code: [t.empty] });
      if (!CODES[code] || CODES[code].status !== 'active') return error(422, 'validation_failed', locale, { code: [t.invalid] });
      const codes = state.codesOf(session);
      if (codes.includes(code)) return error(422, 'validation_failed', locale, { code: [t.alreadyAdded] });
      codes.push(code);
      return [201, { data: { message: t.added, vouchers: page(session, locale) } }];
    },
    /** POST /__mode {"vouchers": {...}} */
    mode(body) {
      if (body && typeof body.vouchers === 'object' && body.vouchers) state.setMode(body.vouchers);
      return { vouchers: state.mode() };
    },
    decorate(endpoint, data) {
      if (endpoint !== 'layout') return data;
      return { ...data, features: { ...data.features, vouchers: state.on } };
    },
    reset() {
      state.reset();
    },
  };
}
