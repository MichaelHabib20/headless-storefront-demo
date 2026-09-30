/**
 * Mock module: the product page.
 *   GET  /products/{slug}                  → ProductDetailsResponse; 404 not_found for an unknown slug
 *   GET  /products/{slug}/recommendations  → ProductRecommendationsResponse
 *   GET  /products/{slug}/reviews          → ProductReviewsResponse (?page, ?perPage)
 *   POST /products/{id}/notify-me          → {data: {subscribed: true}}, 401, 404, 409 already_available,
 *                                            422 validation_failed with fields.email
 *   POST /__mock/products/{id}/restock     → test control: the product is back in stock (until /__reset)
 *
 * Every product is one of the shopper store's (same ids, so add to cart / wishlist / compare work)
 * with its slug in each language. A few are given a state to make every screen reachable:
 *   9822  J&J Baby Cologne 100 ml Dream   size (buttons) × scent (color swatches), 23 reviews, rating,
 *                                          notices, related + bought-together rows with a total
 *   14400 … Morning Dew                   out of stock, "tell me when it is back"
 *   14482 … Lemon Fresh / 36510 200 ml    the other variants (200 ml exists only in Dream → unavailable)
 *   36480 Bedtime Bath 125 ml             gallery of 4 images + a video; size as a dropdown with 8658
 *   8658  Bedtime Bath 500 ml             discounted (180 instead of 200, "10 %")
 *   8412  Sleep Time shampoo              "Only 3 left"; type drawn as images with 15472
 *   15472 Sleep Time bath                 coming soon (no SKU, cannot be bought, no notify-me)
 *   33594 Baby Bath 500 ml                reviews switched off
 *   7346  No More Tangles                 English slug asked in Arabic → `redirect` (like every product
 *                                          whose slugs differ per language)
 * The price and stock changes above belong to this module's answers only: the shopper store's cart
 * still prices a line from the home-page card (mock scaffolding, not business rules).
 */
import { priceWithText } from './shopper.mjs';

const TEXT = {
  en: {
    home: 'Home',
    category: 'Mom & Baby',
    outOfStock: 'Out of stock',
    comingSoon: 'Coming soon: expected next month',
    onlyLeft: (n) => `Only ${n} left`,
    saleBadge: 'Limited offer',
    summary: (name) => `${name}: gentle care made for your baby's delicate skin.`,
    descriptionTitle: 'Why parents love it',
    description: 'Clinically proven mildness, tested by dermatologists and pediatricians. Free of parabens, phthalates, sulfates and dyes.',
    points: ['Gentle enough for every day', 'Hypoallergenic formula', 'Fresh scent that lasts'],
    specs: { brand: 'Brand', origin: 'Country of origin', originValue: 'Egypt', package: 'Package', packageValue: 'Bottle' },
    notices: {
      promotion: 'Buy 2 and get 10% off the second one',
      payment_offer: 'Pay in 4 installments with no interest',
      info: 'Free samples with every order this week',
    },
    seoDescription: (name) => `Buy ${name} online with fast delivery.`,
    sections: { related: 'You may also like', similar: 'Similar products', frequently_bought_together: 'Frequently bought together' },
    view: (n) => `view ${n}`,
    alreadyAvailable: 'Good news: this product is back in stock. You can add it to your cart now.',
    emailRequired: 'Enter your email so we can tell you when it is back.',
    emailInvalid: 'Enter a valid email address.',
    validation: 'Please check the highlighted fields.',
    unauthenticated: 'Please start a session first.',
    notFound: 'This product could not be found.',
  },
  ar: {
    home: 'الرئيسية',
    category: 'العناية بالام والطفل',
    outOfStock: 'غير متوفر',
    comingSoon: 'قريباً: متوقع الشهر القادم',
    onlyLeft: (n) => `متبقي ${n} فقط`,
    saleBadge: 'عرض لفترة محدودة',
    summary: (name) => `${name}: عناية لطيفة مصممة لبشرة طفلك الحساسة.`,
    descriptionTitle: 'لماذا يحبه الآباء',
    description: 'لطيف ومثبت إكلينيكياً، ومختبر من أطباء الجلدية والأطفال. خالٍ من البارابين والفثالات والكبريتات والأصباغ.',
    points: ['لطيف بما يكفي للاستخدام اليومي', 'تركيبة مضادة للحساسية', 'رائحة منعشة تدوم'],
    specs: { brand: 'الماركة', origin: 'بلد المنشأ', originValue: 'مصر', package: 'العبوة', packageValue: 'زجاجة' },
    notices: {
      promotion: 'اشترِ 2 واحصل على خصم 10% على الثانية',
      payment_offer: 'قسّط على 4 دفعات بدون فوائد',
      info: 'عينات مجانية مع كل طلب هذا الأسبوع',
    },
    seoDescription: (name) => `اشترِ ${name} أونلاين مع توصيل سريع.`,
    sections: { related: 'قد يعجبك أيضاً', similar: 'منتجات مشابهة', frequently_bought_together: 'يُشترى معاً عادةً' },
    view: (n) => `صورة ${n}`,
    alreadyAvailable: 'خبر سار: هذا المنتج متوفر الآن. يمكنك إضافته إلى السلة.',
    emailRequired: 'أدخل بريدك الإلكتروني لنبلغك عند توفره.',
    emailInvalid: 'أدخل بريداً إلكترونياً صحيحاً.',
    validation: 'يرجى مراجعة الحقول المحددة.',
    unauthenticated: 'يرجى بدء جلسة أولاً.',
    notFound: 'تعذر العثور على هذا المنتج.',
  },
};

/** Variant families: each option value of each variant; a click on a value opens the variant that has it. */
const FAMILIES = [
  {
    options: [
      {
        id: 11,
        name: { en: 'Size', ar: 'الحجم' },
        display: 'buttons',
        values: [
          { id: 111, label: { en: '100 ml', ar: '100 مل' } },
          { id: 112, label: { en: '200 ml', ar: '200 مل' } },
        ],
      },
      {
        id: 12,
        name: { en: 'Scent', ar: 'الرائحة' },
        display: 'color',
        values: [
          { id: 121, label: { en: 'Dream', ar: 'أحلام' }, color: '#b39ddb' },
          { id: 122, label: { en: 'Morning Dew', ar: 'ندى الصباح' }, color: '#80deea' },
          { id: 123, label: { en: 'Lemon Fresh', ar: 'ليمون منعش' }, color: '#fff176' },
        ],
      },
    ],
    variants: { 9822: [111, 121], 14400: [111, 122], 14482: [111, 123], 36510: [112, 121] },
  },
  {
    options: [
      {
        id: 21,
        name: { en: 'Size', ar: 'الحجم' },
        display: 'dropdown',
        values: [
          { id: 211, label: { en: '125 ml', ar: '125 مل' } },
          { id: 212, label: { en: '500 ml', ar: '500 مل' } },
        ],
      },
    ],
    variants: { 36480: [211], 8658: [212] },
  },
  {
    options: [
      {
        id: 31,
        name: { en: 'Type', ar: 'النوع' },
        display: 'image',
        values: [
          { id: 311, label: { en: 'Shampoo', ar: 'شامبو' }, imageOf: 8412 },
          { id: 312, label: { en: 'Bath', ar: 'غسول' }, imageOf: 15472 },
        ],
      },
    ],
    variants: { 8412: [311], 15472: [312] },
  },
];

const STOCK = { 14400: 'out_of_stock', 15472: 'coming_soon' };
const SALES = { 8658: { amount: 180, compareAt: 200, discountPercent: 10 } };
const LOW_STOCK = { 8412: 3 };
const NOTICES = { 9822: ['promotion', 'payment_offer'], 8658: ['info'] };
const EXTRA_IMAGES = { 36480: [8658, 15472, 8412] };
const VIDEOS = { 36480: { url: 'https://www.youtube.com/watch?v=jjBedtimeBath', thumbnailOf: 8658 } };
const REVIEW_COUNTS = { 9822: 23 };
const REVIEWS_OFF = new Set([33594]);
const RECOMMENDATIONS = {
  9822: [
    { key: 'related', ids: [14400, 14482, 36510, 36480] },
    { key: 'frequently_bought_together', ids: [9822, 36480, 8412], total: true },
  ],
  36480: [{ key: 'related', ids: [8658, 8412, 15472] }],
};

const REVIEWERS = [
  { en: 'Sara M.', ar: 'سارة م.' },
  { en: 'Ahmed K.', ar: 'أحمد ك.' },
  { en: 'Mona A.', ar: 'منى ع.' },
  { en: 'Omar H.', ar: 'عمر ح.' },
  { en: 'Nour S.', ar: 'نور س.' },
];
const COMMENTS = [
  { en: 'Lovely scent that lasts all day.', ar: 'رائحة جميلة تدوم طوال اليوم.' },
  { en: "Gentle on my baby's skin.", ar: 'لطيف على بشرة طفلي.' },
  { en: 'Good, but the bottle is small.', ar: 'جيد لكن العبوة صغيرة.' },
  { en: 'Arrived quickly and well packed.', ar: 'وصل بسرعة ومغلف جيداً.' },
  { en: 'We buy it every month.', ar: 'نشتريه كل شهر.' },
  { en: 'Not my favourite scent.', ar: 'ليست رائحتي المفضلة.' },
];
const RATINGS = [5, 5, 4, 5, 3, 5, 4, 5, 2, 5, 4, 1];

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function createProductModule(shopper, { now = () => new Date('2026-09-29T10:00:00Z') } = {}) {
  const restocked = new Set();
  const subscriptions = new Set();

  // slug (either language) → product id
  const slugs = new Map();
  const ids = shopper.products('en').map((card) => card.id);
  for (const locale of ['en', 'ar']) for (const card of shopper.products(locale)) slugs.set(`${locale}:${card.slug}`, card.id);
  const slugOf = (id, locale) => shopper.product(id, locale)?.slug ?? null;

  const stockOf = (id) => (restocked.has(id) ? 'available' : (STOCK[id] ?? 'available'));
  const image = (id, locale) => shopper.product(id, locale)?.image ?? null;

  function reviewsOf(id, locale) {
    const count = REVIEW_COUNTS[id] ?? 0;
    return Array.from({ length: count }, (_, i) => ({
      id: id * 100 + count - i,
      author: i % 4 === 3 ? null : REVIEWERS[i % REVIEWERS.length][locale],
      rating: RATINGS[i % RATINGS.length],
      comment: i % 7 === 6 ? null : COMMENTS[i % COMMENTS.length][locale],
      createdAt: new Date(now().getTime() - (i * 3 + 1) * 86400000).toISOString(),
    }));
  }

  function reviewSummary(id) {
    const items = reviewsOf(id, 'en');
    if (!items.length) return null;
    const average = Math.round((items.reduce((sum, r) => sum + r.rating, 0) / items.length) * 10) / 10;
    const distribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = items.filter((r) => r.rating === stars).length;
      return { stars, count, percent: Math.round((count / items.length) * 100) };
    });
    return { average, count: items.length, distribution };
  }

  /** The product card as this module presents it (stock, sale and rating states applied). */
  function card(id, locale) {
    const base = shopper.product(id, locale);
    if (!base) return null;
    const result = structuredClone(base);
    const stock = stockOf(id);
    if (stock !== 'available') {
      result.inStock = false;
      result.purchase = { ...result.purchase, canAddToCart: false };
    }
    if (stock === 'coming_soon') result.badges = [{ kind: 'coming_soon', text: null, color: null }];
    if (SALES[id]) {
      result.price = priceWithText({ currency: result.price?.currency ?? 'EGP', ...SALES[id] }, locale);
      result.badges = [...result.badges, { kind: 'promotion', text: TEXT[locale].saleBadge, color: '#e32b2b' }];
    }
    const summary = reviewSummary(id);
    if (summary) result.rating = { average: summary.average, count: summary.count };
    return result;
  }

  function options(id, locale) {
    const family = FAMILIES.find((f) => f.variants[id]);
    if (!family) return [];
    const mine = family.variants[id];
    return family.options.map((option, index) => ({
      id: option.id,
      name: option.name[locale],
      display: option.display,
      values: option.values.map((value) => {
        const base = { id: value.id, label: value.label[locale], color: value.color ?? null, image: value.imageOf ? (image(value.imageOf, locale)?.url ?? null) : null };
        if (mine[index] === value.id) return { ...base, state: 'selected', target: null };
        const wanted = mine.map((valueId, i) => (i === index ? value.id : valueId));
        const variant = Object.entries(family.variants).find(([, values]) => values.every((v, i) => v === wanted[i]));
        if (!variant) return { ...base, state: 'unavailable', target: null };
        const variantId = Number(variant[0]);
        return { ...base, state: stockOf(variantId) === 'available' ? 'available' : 'out_of_stock', target: { type: 'product', slug: slugOf(variantId, locale) } };
      }),
    }));
  }

  function availability(id, locale) {
    const t = TEXT[locale];
    const stock = stockOf(id);
    if (stock === 'out_of_stock') return { status: 'out_of_stock', message: t.outOfStock, notifyMe: true };
    if (stock === 'coming_soon') return { status: 'coming_soon', message: t.comingSoon, notifyMe: false };
    return { status: 'available', message: LOW_STOCK[id] ? t.onlyLeft(LOW_STOCK[id]) : null, notifyMe: false };
  }

  function details(id, locale, requestedSlug) {
    const t = TEXT[locale];
    const product = card(id, locale);
    const name = escapeHtml(product.name);
    const gallery = [product.image, ...(EXTRA_IMAGES[id] ?? []).map((other, i) => {
      const extra = image(other, locale);
      return extra && { url: extra.url, alt: `${product.name}, ${t.view(i + 2)}` };
    })].filter(Boolean);
    const video = VIDEOS[id] ? { url: VIDEOS[id].url, thumbnail: image(VIDEOS[id].thumbnailOf, locale)?.url ?? null } : null;
    const own = product.slug;
    return {
      product,
      redirect: requestedSlug === own ? null : { type: 'product', slug: own },
      sku: stockOf(id) === 'coming_soon' ? null : `JJ-${id}`,
      gallery,
      video,
      options: options(id, locale),
      availability: availability(id, locale),
      quantityStep: 1,
      breadcrumbs: [
        { label: t.home, target: { type: 'home' } },
        { label: t.category, target: { type: 'category', path: ['mom-baby'] } },
        ...(product.brand ? [{ label: product.brand.name, target: product.brand.target }] : []),
        { label: product.name, target: null },
      ],
      summary: { html: `<p>${escapeHtml(t.summary(product.name))}</p>` },
      description: {
        html: `<h3>${t.descriptionTitle}</h3><p>${t.description}</p><ul>${t.points.map((point) => `<li>${point}</li>`).join('')}</ul><p><strong>${name}</strong></p>`,
      },
      specifications: [
        ...(product.brand ? [{ name: t.specs.brand, value: product.brand.name }] : []),
        { name: t.specs.origin, value: t.specs.originValue },
        { name: t.specs.package, value: t.specs.packageValue },
      ],
      notices: (NOTICES[id] ?? []).map((kind) => ({ kind, text: t.notices[kind] })),
      seo: {
        title: product.name,
        description: t.seoDescription(product.name),
        canonical: { type: 'product', slug: own },
        alternates: ['en', 'ar'].map((alt) => ({ locale: alt, target: { type: 'product', slug: slugOf(id, alt) } })),
        index: true,
      },
    };
  }

  function recommendations(id, locale) {
    const t = TEXT[locale];
    const plan = RECOMMENDATIONS[id] ?? [{ key: 'similar', ids: ids.filter((other) => other !== id).slice(0, 5) }];
    return {
      sections: plan.map((section) => {
        const products = section.ids.map((other) => card(other, locale)).filter(Boolean);
        const sum = products.reduce((total, p) => total + (p.price?.amount ?? 0), 0);
        return { key: section.key, title: t.sections[section.key], products, total: section.total ? shopper.total(sum, locale) : null };
      }),
    };
  }

  function reviews(id, locale, query) {
    const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 20) || 20));
    const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
    if (REVIEWS_OFF.has(id)) return { enabled: false, summary: null, items: [], pagination: { page, perPage, total: 0, totalPages: 0 } };
    const all = reviewsOf(id, locale);
    return {
      enabled: true,
      summary: reviewSummary(id),
      items: all.slice((page - 1) * perPage, page * perPage),
      pagination: { page, perPage, total: all.length, totalPages: Math.ceil(all.length / perPage) },
    };
  }

  /** The product a slug in either language belongs to. */
  const find = (slug, locale) => slugs.get(`${locale}:${slug}`) ?? slugs.get(`${locale === 'ar' ? 'en' : 'ar'}:${slug}`) ?? null;

  function decode(segment) {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }

  return {
    handle({ method, pathname, query, token, locale, body }) {
      const t = TEXT[locale];
      const error = (status, code, message, extra = {}) => [status, { error: { code, message, ...extra } }];

      const restock = pathname.match(/^\/__mock\/products\/(\d+)\/restock$/);
      if (restock && method === 'POST') {
        restocked.add(Number(restock[1]));
        return [200, { data: { restocked: Number(restock[1]) } }];
      }

      const notify = pathname.match(/^\/products\/(\d+)\/notify-me$/);
      if (notify && method === 'POST') {
        const session = shopper.session(token);
        if (!session) return error(401, 'unauthenticated', t.unauthenticated);
        const id = Number(notify[1]);
        if (!shopper.product(id, locale)) return error(404, 'not_found', t.notFound);
        if (stockOf(id) === 'available') return error(409, 'already_available', t.alreadyAvailable);
        const email = typeof body?.email === 'string' ? body.email.trim() : '';
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error(422, 'validation_failed', t.validation, { fields: { email: [t.emailInvalid] } });
        // A signed-in customer's email is known; a guest has to give one.
        if (!email && session.isGuest) return error(422, 'validation_failed', t.validation, { fields: { email: [t.emailRequired] } });
        subscriptions.add(`${token}:${id}`);
        return [200, { data: { subscribed: true } }];
      }

      const read = pathname.match(/^\/products\/([^/]+)(?:\/(recommendations|reviews))?$/);
      if (!read || method !== 'GET') return null;
      const slug = decode(read[1]);
      const id = find(slug, locale);
      if (id === null) return error(404, 'not_found', t.notFound);
      if (read[2] === 'recommendations') return [200, { data: recommendations(id, locale) }];
      if (read[2] === 'reviews') return [200, { data: reviews(id, locale, query) }];
      return [200, { data: details(id, locale, slug) }];
    },
    reset() {
      restocked.clear();
      subscriptions.clear();
    },
    /** For tests: whether a shopper asked to be told about a product. */
    subscribed: (token, id) => subscriptions.has(`${token}:${id}`),
  };
}
