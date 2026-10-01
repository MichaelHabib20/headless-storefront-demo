/**
 * Mock module: the customer's loyalty, El Dokan or iVend (contract: LoyaltySummary, LoyaltyReward,
 * LoyaltyEntry, LoyaltyReferral; design: account-extras-v3-design.md §3). Customer token only
 * (guests → 401); 404 while no provider, or for a page the provider lacks.
 *   GET  /loyalty                         → LoyaltySummaryResponse
 *   GET  /loyalty/history?page&perPage    → LoyaltyHistoryResponse (El Dokan)
 *   GET  /loyalty/rewards                 → LoyaltyRewardsResponse (El Dokan)
 *   GET  /loyalty/rewards/{id}            → LoyaltyRewardResponse (El Dokan)
 *   POST /loyalty/rewards/{id}/redeem     → 201 LoyaltyRedeemResponse | 409 cannot_redeem (El Dokan)
 *   GET  /loyalty/referral                → LoyaltyReferralResponse (El Dokan + referral on)
 * The seeded customer ("Bearer test-customer") has 1,000 points, has spent 700 of the 1,000 EGP Gold
 * level; rewards: a 50 EGP voucher (500), 10% up to 50 EGP (800), Gold-only free delivery (300), a gift (2,000).
 * Off by default, as on staging. Switches: POST /__mode {"loyalty": {"provider": null | "elDokan" | "ivend",
 * "phone": "ok" | "unverified" | "missing", "referral": true | false}}.
 * Test scaffolding only: the real rules are the backend's.
 */

const TEXT = {
  en: {
    title: 'Your points', point: 'point', points: 'points',
    description: '<p>Earn points with every delivered order and spend them on rewards.</p>',
    pending: (p) => `${p} will be ready to use soon.`, expiring: (p) => `${p} expire on 31 Dec 2026.`,
    member: 'Member', gold: 'Gold member', toGold: 'Spend 300 EGP more to become a Gold member.', goldBadge: 'Gold members',
    goldOnly: 'For Gold members only.', needMore: (p) => `You need ${p} more.`,
    add_phone: 'Add your phone number to your profile to redeem rewards.', verify_phone: 'Verify your phone number to redeem rewards.',
    voucherReady: 'Your voucher code is ready. Use it at checkout before it expires.', giftReady: 'We received your request for this gift.',
    referralTitle: 'Get free points',
    referral: 'Share your code with friends. They enter it when they sign up. When their order is delivered, you both get 50 points.',
    share: 'Use my code MONA50 at Seif Pharmacies.',
    errors: { not_found: 'Not found.', unauthenticated: 'Please sign in first.' },
    rewards: [
      { name: '50 EGP off', description: 'On any order.', benefit: '50 EGP off' },
      { name: '10% off', description: null, benefit: '10% off, up to 50 EGP' },
      { name: 'Free delivery', description: 'Your next delivery is on us.', benefit: 'Free delivery' },
      { name: 'Tote bag', description: 'A Seif Pharmacies tote bag, handed over with your next order.', benefit: null },
    ],
    history: {
      pending: ['Points from order #48300', 'Available from 12 Oct 2026'],
      used: ['Redeemed: 50 EGP off', 'Voucher code GIFT-AB12C'],
      referral: ['Referral points', null],
      earned: ['Points from order #48213', 'You spent 600 EGP'],
      expired: ['Points expired', null],
    },
    money: (n) => `${n} EGP`,
  },
  ar: {
    title: 'نقاطي', point: 'نقطة', points: 'نقطة',
    description: '<p>اكسب نقاطاً مع كل طلب يتم توصيله واستبدلها بمكافآت.</p>',
    pending: (p) => `ستكون ${p} جاهزة للاستخدام قريباً.`, expiring: (p) => `تنتهي صلاحية ${p} في 31 ديسمبر 2026.`,
    member: 'عضو', gold: 'عضو ذهبي', toGold: 'أنفق 300 جنية إضافية لتصبح عضواً ذهبياً.', goldBadge: 'للأعضاء الذهبيين',
    goldOnly: 'للأعضاء الذهبيين فقط.', needMore: (p) => `تحتاج إلى ${p} إضافية.`,
    add_phone: 'أضف رقم هاتفك إلى ملفك الشخصي لاستبدال المكافآت.', verify_phone: 'وثّق رقم هاتفك لاستبدال المكافآت.',
    voucherReady: 'كود الخصم جاهز. استخدمه عند إتمام الطلب قبل انتهاء صلاحيته.', giftReady: 'استلمنا طلبك لهذه الهدية.',
    referralTitle: 'احصل على نقاط مجانية',
    referral: 'شارك كودك مع أصدقائك. يدخلونه عند التسجيل. عند توصيل طلبهم يحصل كل منكما على 50 نقطة.',
    share: 'استخدم كودي MONA50 في صيدليات سيف.',
    errors: { not_found: 'غير موجود.', unauthenticated: 'يرجى تسجيل الدخول أولاً.' },
    rewards: [
      { name: 'خصم 50 جنية', description: 'على أي طلب.', benefit: 'خصم 50 جنية' },
      { name: 'خصم 10%', description: null, benefit: 'خصم 10%، بحد أقصى 50 جنية' },
      { name: 'توصيل مجاني', description: 'التوصيل القادم علينا.', benefit: 'توصيل مجاني' },
      { name: 'حقيبة قماش', description: 'حقيبة صيدليات سيف تُسلّم مع طلبك القادم.', benefit: null },
    ],
    history: {
      pending: ['نقاط من الطلب رقم 48300', 'متاحة من 12 أكتوبر 2026'],
      used: ['استبدال: خصم 50 جنية', 'كود الخصم GIFT-AB12C'],
      referral: ['نقاط الإحالة', null],
      earned: ['نقاط من الطلب رقم 48213', 'أنفقت 600 جنية'],
      expired: ['نقاط منتهية الصلاحية', null],
    },
    money: (n) => `${n} جنية`,
  },
};

/** id, kind, cost, Gold only, image */
const REWARDS = [
  { id: '3', kind: 'voucher', cost: 500, gold: false, image: 'https://cdn.supercommerce.io/supercommerce-demo/uploads/reward-voucher.png' },
  { id: '4', kind: 'voucher', cost: 800, gold: false, image: null },
  { id: '5', kind: 'voucher', cost: 300, gold: true, image: null },
  { id: '6', kind: 'gift', cost: 2000, gold: false, image: null },
];

/** The seeded history, newest first: kind, points, date, order id. */
const HISTORY = [
  { id: 'earned-13', kind: 'pending', points: 80, sign: '+', date: '2026-09-28T18:00:00+03:00', orderId: 'mock-order-48201' },
  { id: 'used-5', kind: 'used', points: 500, sign: '-', date: '2026-09-25T12:00:00+03:00', orderId: null },
  { id: 'earned-12', kind: 'referral', points: 50, sign: '+', date: '2026-09-20T09:00:00+03:00', orderId: null },
  { id: 'earned-11', kind: 'earned', points: 120, sign: '+', date: '2026-09-10T10:00:00+03:00', orderId: 'mock-order-48200' },
  { id: 'expired-2026-06-30', kind: 'expired', points: 40, sign: '-', date: '2026-06-30T00:00:00+03:00', orderId: null },
];

const fresh = () => ({ provider: null, phone: 'ok', referral: true });

export function createLoyaltyModule(shopper) {
  let mode = fresh();
  let redeemed = 0;

  const error = (status, code, locale) => [status, { error: { code, message: TEXT[locale].errors[code] ?? code } }];
  const points = (n, locale, sign = '') => ({
    amount: sign === '-' ? -n : n,
    text: `${sign}${n.toLocaleString('en-US')} ${n === 1 ? TEXT[locale].point : TEXT[locale].points}`,
  });
  const money = (n, locale) => ({ amount: n, currency: 'EGP', display: TEXT[locale].money(n.toLocaleString('en-US')) });
  const balanceOf = (session) => {
    if (session.loyaltyPoints === undefined) session.loyaltyPoints = session === shopper.session('test-customer') ? 1000 : 0;
    return session.loyaltyPoints;
  };
  const elDokan = () => mode.provider === 'elDokan';

  function summary(session, locale) {
    const t = TEXT[locale];
    const base = { provider: mode.provider, title: t.title, description: { html: t.description }, value: null, storeCredit: null, tier: null, pending: null, expiring: null };
    if (mode.provider === 'ivend') {
      return { ...base, points: points(1500, locale), value: money(100, locale), storeCredit: money(25.5, locale), sections: { rewards: false, history: false, referral: false } };
    }
    return {
      ...base,
      points: points(balanceOf(session), locale),
      tier: { gold: false, label: t.member, message: t.toGold },
      pending: t.pending(points(80, locale).text),
      expiring: t.expiring(points(300, locale).text),
      sections: { rewards: true, history: true, referral: mode.referral },
    };
  }

  function blocker(locale) {
    if (mode.phone === 'missing') return { code: 'add_phone', message: TEXT[locale].add_phone };
    if (mode.phone === 'unverified') return { code: 'verify_phone', message: TEXT[locale].verify_phone };
    return null;
  }

  /** Legacy order: Gold, points, then the phone. The seeded customer is not Gold. */
  function refusal(reward, balance, locale) {
    if (reward.gold) return TEXT[locale].goldOnly;
    if (balance < reward.cost) return TEXT[locale].needMore(points(reward.cost - balance, locale).text);
    return blocker(locale)?.message ?? null;
  }

  function reward(row, session, locale) {
    const t = TEXT[locale];
    const text = t.rewards[REWARDS.indexOf(row)];
    const reason = refusal(row, balanceOf(session), locale);
    return {
      id: row.id,
      name: text.name,
      description: text.description,
      image: row.image,
      kind: row.kind,
      benefit: text.benefit,
      cost: points(row.cost, locale),
      badge: row.gold ? t.goldBadge : null,
      canRedeem: reason === null,
      reason,
    };
  }

  function entry(row, locale) {
    const [title, detail] = TEXT[locale].history[row.kind];
    return { id: row.id, kind: row.kind, title, detail, points: points(row.points, locale, row.sign), date: row.date, orderId: row.orderId };
  }

  return {
    handle({ method, pathname, token, locale, query }) {
      if (pathname !== '/loyalty' && !pathname.startsWith('/loyalty/')) return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!mode.provider) return error(404, 'not_found', locale);

      if (method === 'GET' && pathname === '/loyalty') return [200, { data: summary(session, locale) }];
      if (!elDokan()) return error(404, 'not_found', locale);

      if (method === 'GET' && pathname === '/loyalty/history') {
        const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 20) || 20));
        const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
        return [200, { data: { items: HISTORY.slice((page - 1) * perPage, page * perPage).map((row) => entry(row, locale)), pagination: { page, perPage, total: HISTORY.length, totalPages: Math.ceil(HISTORY.length / perPage) } } }];
      }
      if (method === 'GET' && pathname === '/loyalty/rewards') {
        return [200, { data: { points: points(balanceOf(session), locale), blocker: blocker(locale), items: REWARDS.map((row) => reward(row, session, locale)) } }];
      }
      if (method === 'GET' && pathname === '/loyalty/referral') {
        if (!mode.referral) return error(404, 'not_found', locale);
        return [200, { data: { code: 'MONA50', title: TEXT[locale].referralTitle, message: TEXT[locale].referral, shareText: TEXT[locale].share, points: points(50, locale) } }];
      }
      const one = pathname.match(/^\/loyalty\/rewards\/([^/]+)(\/redeem)?$/);
      const row = one ? REWARDS.find((r) => r.id === decodeURIComponent(one[1])) : null;
      if (!row) return error(404, 'not_found', locale);
      if (method === 'GET' && !one[2]) {
        return [200, { data: { points: points(balanceOf(session), locale), blocker: blocker(locale), reward: reward(row, session, locale) } }];
      }
      if (method === 'POST' && one[2]) {
        const reason = refusal(row, balanceOf(session), locale);
        if (reason) return [409, { error: { code: 'cannot_redeem', message: reason } }];
        session.loyaltyPoints = balanceOf(session) - row.cost;
        redeemed++;
        const voucher = row.kind === 'voucher';
        return [201, {
          data: {
            redemption: {
              kind: row.kind,
              code: voucher ? `GIFT-MOCK${redeemed}` : null,
              expiresAt: voucher ? '2026-11-01T12:00:00+02:00' : null,
              message: voucher ? TEXT[locale].voucherReady : TEXT[locale].giftReady,
            },
            points: points(session.loyaltyPoints, locale),
          },
        }];
      }
      return error(404, 'not_found', locale);
    },
    /** POST /__mode {"loyalty": {...}} */
    mode(body) {
      if (body && typeof body.loyalty === 'object' && body.loyalty) mode = { ...mode, ...body.loyalty };
      return { loyalty: { ...mode } };
    },
    /** The layout's switch and the bottom nav's points item follow the mock's provider. */
    decorate(endpoint, data, locale) {
      if (endpoint !== 'layout') return data;
      const on = Boolean(mode.provider);
      const next = { ...data, features: { ...data.features, loyalty: on } };
      const nav = data.mobileNav;
      if (on && nav && !nav.more.items.some((item) => item.id === 'points')) {
        const items = [...nav.more.items];
        const language = items.findIndex((item) => item.id === 'language');
        items.splice(language < 0 ? items.length : language, 0, { id: 'points', label: locale === 'ar' ? 'النقاط' : 'Points', icon: 'star', target: null, badge: null });
        next.mobileNav = { ...nav, more: { ...nav.more, items } };
      }
      return next;
    },
    reset() {
      mode = fresh();
      redeemed = 0;
    },
  };
}
