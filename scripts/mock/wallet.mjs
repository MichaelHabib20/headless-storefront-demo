/**
 * Mock module: the customer wallet (contract: Wallet, WalletEntry, Checkout.wallet; design:
 * phase-b-v3-design.md §1). Customer token only (guests → 401); 404 while the store has it off.
 *   GET /wallet?page&perPage → WalletResponse
 * The seeded customer ("Bearer test-customer") has 150 EGP: 200 added by the store, 50 paid for order
 * #48200. Paying with the wallet at checkout (checkout.mjs) takes from this balance and adds a row.
 * Off by default, as on staging. Switches: POST /__mode {"wallet": {"on": true | false, "balance": 150}}.
 * Test scaffolding only: the real rules are the backend's.
 */

const TEXT = {
  en: {
    title: 'My wallet',
    hint: 'You can use your balance to pay at checkout.',
    deposit: 'Added by the store',
    paymentOrder: (n) => `Paid for order #${n}`,
    refundOrder: (n) => `Refund for order #${n}`,
    errors: { not_found: 'Not found.', unauthenticated: 'Please start a session first.' },
  },
  ar: {
    title: 'محفظتي',
    hint: 'يمكنك استخدام رصيدك للدفع عند إتمام الطلب.',
    deposit: 'إضافة من المتجر',
    paymentOrder: (n) => `دفع للطلب رقم ${n}`,
    refundOrder: (n) => `استرداد للطلب رقم ${n}`,
    errors: { not_found: 'غير موجود.', unauthenticated: 'يرجى بدء جلسة أولاً.' },
  },
};

/** One wallet state per shopper store, shared with the checkout module. */
const STATES = new WeakMap();

const freshMode = () => ({ on: false, balance: 150 });

/** The seeded history of the test customer, newest first: kind, amount (signed), date, order number. */
const SEEDED = () => [
  { id: '2', kind: 'payment', amount: -50, date: '2026-09-20T10:00:00+03:00', order: '48200' },
  { id: '1', kind: 'deposit', amount: 200, date: '2026-09-01T10:00:00+03:00', order: null },
];

const round2 = (n) => Math.round(n * 100) / 100;

/** A signed total in the shopper store's Money format (the minus sign first, like the checkout lines). */
export function signedTotal(shopper, amount, locale) {
  const positive = shopper.total(Math.abs(amount), locale);
  return amount < 0 ? { ...positive, amount: -positive.amount, display: `-${positive.display}` } : positive;
}

/**
 * The wallet of the shopper store: `on`, and per session the balance and history. The checkout
 * module reads `balanceOf()` and calls `spend()` when an order is paid partly or fully from it.
 */
export function walletState(shopper) {
  let state = STATES.get(shopper);
  if (state) return state;
  let mode = freshMode();
  const isSeeded = (session) => session === shopper.session('test-customer');
  const ensure = (session) => {
    if (session.wallet === undefined) session.wallet = isSeeded(session) ? { balance: mode.balance, rows: SEEDED() } : { balance: 0, rows: [] };
    return session.wallet;
  };
  let nextId = 100;
  state = {
    get on() {
      return mode.on;
    },
    mode: () => ({ ...mode }),
    setMode(input) {
      mode = { ...mode, ...input };
      // a new seeded balance applies to the test customer at once
      const seeded = shopper.session('test-customer');
      if (seeded && 'balance' in input) ensure(seeded).balance = Number(input.balance) || 0;
    },
    reset() {
      mode = freshMode();
      nextId = 100;
    },
    balanceOf: (session) => (mode.on && session && !session.isGuest ? ensure(session).balance : 0),
    history: (session) => ensure(session).rows,
    spend(session, amount, orderNumber) {
      const wallet = ensure(session);
      wallet.balance = round2(wallet.balance - amount);
      wallet.rows.unshift({ id: String(++nextId), kind: 'payment', amount: -amount, date: '2026-09-29T10:00:00.000Z', order: orderNumber });
    },
  };
  STATES.set(shopper, state);
  return state;
}

export function createWalletModule(shopper) {
  const state = walletState(shopper);
  const error = (status, code, locale) => [status, { error: { code, message: TEXT[locale].errors[code] ?? code } }];

  function entry(row, locale) {
    const t = TEXT[locale];
    const title = row.kind === 'payment' ? t.paymentOrder(row.order) : row.kind === 'refund' ? t.refundOrder(row.order) : t.deposit;
    return {
      id: row.id,
      kind: row.kind,
      title,
      amount: signedTotal(shopper, row.amount, locale),
      credit: row.amount >= 0,
      date: row.date,
      orderId: row.order ? `mock-order-${row.order}` : null,
    };
  }

  return {
    handle({ method, pathname, token, locale, query }) {
      if (pathname !== '/wallet') return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!state.on) return error(404, 'not_found', locale);
      if (method !== 'GET') return error(404, 'not_found', locale);
      const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 20) || 20));
      const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
      const rows = state.history(session);
      return [200, {
        data: {
          title: TEXT[locale].title,
          balance: shopper.total(state.balanceOf(session), locale),
          hint: TEXT[locale].hint,
          items: rows.slice((page - 1) * perPage, page * perPage).map((row) => entry(row, locale)),
          pagination: { page, perPage, total: rows.length, totalPages: Math.ceil(rows.length / perPage) },
        },
      }];
    },
    /** POST /__mode {"wallet": {...}} */
    mode(body) {
      if (body && typeof body.wallet === 'object' && body.wallet) state.setMode(body.wallet);
      return { wallet: state.mode() };
    },
    /** The layout's switch and the bottom nav's wallet item follow the mock's switch. */
    decorate(endpoint, data, locale) {
      if (endpoint !== 'layout') return data;
      const next = { ...data, features: { ...data.features, wallet: state.on } };
      const nav = data.mobileNav;
      if (state.on && nav && !nav.more.items.some((item) => item.id === 'wallet')) {
        const items = [...nav.more.items];
        const language = items.findIndex((item) => item.id === 'language');
        items.splice(language < 0 ? items.length : language, 0, { id: 'wallet', label: locale === 'ar' ? 'المحفظة' : 'Wallet', icon: 'account_balance_wallet', target: null, badge: null });
        next.mobileNav = { ...nav, more: { ...nav.more, items } };
      }
      return next;
    },
    reset() {
      state.reset();
    },
  };
}
