/**
 * Mock module: product listings, search, categories, brands and the unknown-path resolver.
 *   GET /products            → ProductListingResponse (scopes, filters, sort, pages)
 *   GET /search/suggestions  → SearchSuggestionsResponse
 *   GET /categories          → CategoriesResponse (the tree of the recorded menu)
 *   GET /brands              → BrandsResponse (the recorded featured brands, paged)
 *   GET /resolve             → ResolutionResponse
 *
 * The products are the shopper store's (same ids, names and prices as the cart and wishlist).
 * What a listing needs on top (categories, color, lists, tags, deals) is in FACTS below. Deals
 * show an old price next to the same price the shopper pays everywhere else.
 *
 * Every `query` string (sort, facet values, chips, clear all, the price range) is written by ONE
 * helper, `queryOf()`, so they always agree with what `readFilters()` understands.
 */
import fs from 'node:fs';
import path from 'node:path';
import { priceText, priceWithText } from './shopper.mjs';
import { listingSeoExtras } from './seo-extras.mjs';

const FIXTURES = path.resolve('src/test/fixtures/v3');
/** Store settings of this mock store: products per page, and the most a page may ask for. */
const PER_PAGE = 8;
const MAX_PER_PAGE = 48;
const BRANDS_PER_PAGE = 48;
const SUGGESTIONS = 6;

const TEXT = {
  en: {
    home: 'Home',
    all: 'All products',
    search: (q) => `Search results for "${q}"`,
    searchCrumb: 'Search',
    deals: 'Deals',
    dealsText: '<p>Limited-time offers on <strong>baby care</strong> favourites.</p>',
    category: 'Category',
    brand: 'Brand',
    color: 'Color',
    price: 'Price',
    availability: 'Availability',
    inStock: 'In stock only',
    priceFrom: (min) => `From ${min}`,
    priceTo: (max) => `Up to ${max}`,
    sort: { featured: 'Featured', price_asc: 'Price: low to high', price_desc: 'Price: high to low', name_asc: 'Name: A to Z' },
    invalid: 'Some filters are not valid.',
    number: 'Must be a number of 0 or more.',
    page: 'Must be a whole number of 1 or more.',
    oneScope: 'Send at most one of category, brand, list, tag, deals or q.',
    qRequired: 'Type something to search for.',
    pathRequired: 'The path is required.',
    notFound: 'This page could not be found.',
    storeName: 'Seif Online',
  },
  ar: {
    home: 'الرئيسية',
    all: 'كل المنتجات',
    search: (q) => `نتائج البحث عن "${q}"`,
    searchCrumb: 'البحث',
    deals: 'العروض',
    dealsText: '<p>عروض لفترة محدودة على منتجات <strong>العناية بالطفل</strong>.</p>',
    category: 'الفئة',
    brand: 'الماركة',
    color: 'اللون',
    price: 'السعر',
    availability: 'التوفر',
    inStock: 'المتوفر فقط',
    priceFrom: (min) => `من ${min}`,
    priceTo: (max) => `حتى ${max}`,
    sort: { featured: 'المميز', price_asc: 'السعر: من الأقل للأعلى', price_desc: 'السعر: من الأعلى للأقل', name_asc: 'الاسم: أ إلى ي' },
    invalid: 'بعض الفلاتر غير صحيحة.',
    number: 'يجب أن يكون رقماً 0 أو أكثر.',
    page: 'يجب أن يكون رقماً صحيحاً 1 أو أكثر.',
    oneScope: 'أرسل واحداً فقط من category أو brand أو list أو tag أو deals أو q.',
    qRequired: 'اكتب كلمة للبحث عنها.',
    pathRequired: 'المسار مطلوب.',
    notFound: 'هذه الصفحة غير موجودة.',
    storeName: 'سيف أونلاين',
  },
};

const COLORS = {
  lavender: { hex: '#b39ddb', en: 'Lavender', ar: 'لافندر' },
  blue: { hex: '#64b5f6', en: 'Blue', ar: 'أزرق' },
  pink: { hex: '#f48fb1', en: 'Pink', ar: 'وردي' },
  yellow: { hex: '#ffd54f', en: 'Yellow', ar: 'أصفر' },
};

const BATH = 'mom-baby/baby-care/baby-toiletries-bath-accessories';
const COLOGNE = 'every-day-essentials/body-fresheners/body-cologne';

/** Listing facts per product id (the card itself comes from the shopper store). `was` = old price on deals. */
const FACTS = {
  36480: { categories: [BATH], color: 'lavender', lists: ['125', 'best-sellers'], tags: ['new-arrivals'] },
  7346: { categories: ['hair-care'], color: 'pink', lists: ['best-sellers'], tags: [], was: 200 },
  8412: { categories: [BATH, 'hair-care'], color: 'blue', lists: ['125'], tags: [] },
  8658: { categories: [BATH], color: 'lavender', lists: ['125'], tags: [], was: 250 },
  33594: { categories: [BATH], color: 'yellow', lists: [], tags: ['new-arrivals'] },
  9822: { categories: [COLOGNE], color: 'pink', lists: ['125'], tags: [] },
  14400: { categories: [COLOGNE], color: 'blue', lists: [], tags: ['new-arrivals'] },
  14482: { categories: [COLOGNE], color: 'yellow', lists: [], tags: [], was: 125 },
  36510: { categories: [COLOGNE], color: 'pink', lists: ['best-sellers'], tags: [] },
  15472: { categories: [BATH], color: 'lavender', lists: [], tags: [] },
};

const LISTS = [
  { slug: null, id: 125, title: { en: 'Baby care week', ar: 'أسبوع العناية بالطفل' } },
  { slug: 'best-sellers', id: 7, title: { en: 'Best sellers', ar: 'الأكثر مبيعاً' } },
];
const TAGS = { 'new-arrivals': { en: 'New arrivals', ar: 'وصل حديثاً' } };

const CATEGORY_TEXT = {
  'mom-baby': {
    en: '<p>Everything for <strong>mom and baby</strong>: bath time, skin care and more. <a href="https://example.com/baby-guide">Read our guide</a>.</p>',
    ar: '<p>كل ما تحتاجه <strong>الأم والطفل</strong>: الاستحمام والعناية بالبشرة والمزيد.</p>',
  },
};

/** The unknown paths the mock knows (old storefront URLs and the merchant's redirect table). */
const REDIRECTS = {
  '/summer-sale': { result: 'redirect', target: { type: 'deals' }, url: null, permanent: false },
  '/our-blog': { result: 'redirect', target: null, url: 'https://blog.example.com/', permanent: true },
  '/discontinued-offer': { result: 'gone', target: null, url: null, permanent: true },
  // Broken rows a merchant can type: the storefront must not loop or follow them.
  '/self-redirect': { result: 'redirect', target: null, url: '/{locale}/self-redirect', permanent: false },
  '/unsafe-redirect': { result: 'redirect', target: { type: 'url', url: 'javascript:alert(1)' }, url: null, permanent: true },
};

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8')).data;

/** The category tree of the recorded menu (same slugs in both languages). */
function loadCategories() {
  const nodes = new Map(); // "a/b" → { path, name: {en, ar}, image }
  const images = { en: new Map(), ar: new Map() }; // top-level category → the home page tile's image
  for (const locale of ['en', 'ar']) {
    for (const tile of readJson(`home.${locale}.json`).featuredCategories) {
      if (tile.target?.type === 'category') images[locale].set(tile.target.path.join('/'), tile.image);
    }
  }
  // The menu repeats some categories ("General" → mom-baby): the first entry of a path wins.
  const walk = (items, visit) => {
    for (const item of items) {
      if (item.target?.type === 'category' && item.target.path.length <= 3) visit(item);
      walk(item.children, visit);
    }
  };
  walk(readJson('layout.en.json').navigation, (item) => {
    const key = item.target.path.join('/');
    const parent = item.target.path.slice(0, -1).join('/');
    if (!nodes.has(key) && (!parent || nodes.has(parent))) nodes.set(key, { path: item.target.path, name: { en: item.label, ar: item.label }, image: item.image });
  });
  const named = new Set();
  walk(readJson('layout.ar.json').navigation, (item) => {
    const key = item.target.path.join('/');
    if (nodes.has(key) && !named.has(key)) {
      named.add(key);
      nodes.get(key).name.ar = item.label;
    }
  });
  return { nodes, images };
}

const loadBrands = () => ({ en: readJson('home.en.json').featuredBrands, ar: readJson('home.ar.json').featuredBrands });

// ------------------------------------------------------------------ filters and their query strings

const SORTS = ['featured', 'price_asc', 'price_desc', 'name_asc'];

/**
 * THE query-string writer: every link the listing sends back is `queryOf(filters)` of some
 * filter state. Fixed key order, comma-separated values, defaults left out.
 */
export function queryOf(filters) {
  const params = new URLSearchParams();
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.brands.length) params.set('brands', filters.brands.join(','));
  if (filters.options.length) params.set('options', filters.options.join(','));
  if (filters.inStock) params.set('inStock', 'true');
  if (filters.priceMin !== null) params.set('priceMin', String(filters.priceMin));
  if (filters.priceMax !== null) params.set('priceMax', String(filters.priceMax));
  if (filters.sort !== 'featured') params.set('sort', filters.sort);
  return params.toString();
}

const list = (value) => (value ? value.split(',').filter(Boolean) : []);
const toggled = (values, value) => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
const noFilters = (filters) => ({ ...filters, categories: [], brands: [], options: [], inStock: false, priceMin: null, priceMax: null });
const hasFilters = (f) => f.categories.length || f.brands.length || f.options.length || f.inStock || f.priceMin !== null || f.priceMax !== null;

/** Reads the filter parameters (empty values count as absent, like Laravel). Returns {filters} or {fields}. */
function readFilters(query, t) {
  const fields = {};
  const number = (name) => {
    const raw = query.get(name);
    if (raw === null || raw === '') return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      fields[name] = [t.number];
      return null;
    }
    return value;
  };
  const sort = query.get('sort');
  const filters = {
    categories: list(query.get('categories')),
    brands: list(query.get('brands')),
    options: list(query.get('options')),
    inStock: query.get('inStock') === 'true' || query.get('inStock') === '1',
    priceMin: number('priceMin'),
    priceMax: number('priceMax'),
    sort: SORTS.includes(sort) ? sort : 'featured',
  };
  return Object.keys(fields).length ? { fields } : { filters };
}

function positiveInt(query, name, fallback, max, t, fields) {
  const raw = query.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) {
    fields[name] = [t.page];
    return fallback;
  }
  return Math.min(Number(raw), max);
}

// ------------------------------------------------------------------ the module

export function createCatalogModule(shopper) {
  const { nodes: categories, images: categoryImages } = loadCategories();
  const brands = loadBrands();

  /** A product card for listings: the shopper store's card, with the old price on deals. */
  function card(product, locale) {
    const was = FACTS[product.id]?.was;
    if (!was || !product.price) return product;
    const discountPercent = Math.round((1 - product.price.amount / was) * 100);
    return { ...product, price: priceWithText({ currency: product.price.currency, amount: product.price.amount, compareAt: was, discountPercent }, locale) };
  }

  const products = (locale) => shopper.products(locale).map((product) => card(product, locale));
  const facts = (product) => FACTS[product.id] ?? { categories: [], color: null, lists: [], tags: [] };
  const inCategory = (product, key) => facts(product).categories.some((c) => c === key || c.startsWith(`${key}/`));

  function brandTile(slug, locale) {
    return brands[locale].find((b) => b.target.slug === slug) ?? null;
  }

  function categoryTarget(key) {
    return { type: 'category', path: categories.get(key).path };
  }

  /** Which products a scope covers, and how it presents itself. null = unknown scope (404). */
  function scopeOf(query, locale) {
    const t = TEXT[locale];
    const home = { label: t.home, target: { type: 'home' } };
    const given = ['category', 'brand', 'list', 'tag', 'deals', 'q'].filter((key) => {
      const value = query.get(key);
      return value !== null && value !== '' && !(key === 'deals' && (value === 'false' || value === '0'));
    });
    if (given.length > 1) return { invalid: t.oneScope };
    const all = products(locale);
    const scope = given[0];

    if (!scope) {
      return { type: 'all', title: t.all, items: all, target: { type: 'search', query: '' }, crumbs: [home, { label: t.all, target: { type: 'search', query: '' } }], index: true };
    }
    if (scope === 'q') {
      const q = query.get('q').trim();
      const needle = q.toLocaleLowerCase();
      const items = all.filter((p) => p.name.toLocaleLowerCase().includes(needle) || (p.brand?.name ?? '').toLocaleLowerCase().includes(needle));
      const target = { type: 'search', query: q };
      return { type: 'search', title: t.search(q), query: q, items, target, crumbs: [home, { label: t.searchCrumb, target }], index: false };
    }
    if (scope === 'category') {
      const key = query.get('category');
      const node = categories.get(key);
      if (!node) return null;
      const crumbs = [home];
      for (let i = 1; i <= node.path.length; i++) {
        const partial = node.path.slice(0, i).join('/');
        crumbs.push({ label: categories.get(partial)?.name[locale] ?? partial, target: categoryTarget(partial) });
      }
      const text = CATEGORY_TEXT[key]?.[locale];
      const image = categoryImages[locale].get(key) ?? null;
      return {
        type: 'category',
        title: node.name[locale],
        description: text ? { html: text } : null,
        image,
        items: all.filter((p) => inCategory(p, key)),
        target: categoryTarget(key),
        crumbs,
        category: key,
        index: true,
      };
    }
    if (scope === 'brand') {
      const tile = brandTile(query.get('brand'), locale);
      if (!tile) return null;
      return {
        type: 'brand',
        title: tile.name,
        image: tile.image,
        items: all.filter((p) => p.brand?.slug === tile.target.slug),
        target: tile.target,
        crumbs: [home, { label: tile.name, target: tile.target }],
        index: true,
      };
    }
    if (scope === 'list') {
      const key = query.get('list');
      const found = LISTS.find((l) => l.slug === key || String(l.id) === key);
      if (!found) return null;
      const target = { type: 'list', slug: found.slug, id: found.id };
      const listKey = found.slug ?? String(found.id);
      return { type: 'list', title: found.title[locale], items: all.filter((p) => facts(p).lists.includes(listKey)), target, crumbs: [home, { label: found.title[locale], target }], index: true };
    }
    if (scope === 'tag') {
      const slug = query.get('tag');
      if (!TAGS[slug]) return null;
      const target = { type: 'tag', slug };
      return { type: 'tag', title: TAGS[slug][locale], items: all.filter((p) => facts(p).tags.includes(slug)), target, crumbs: [home, { label: TAGS[slug][locale], target }], index: true };
    }
    // deals
    const target = { type: 'deals' };
    return { type: 'deals', title: t.deals, description: { html: t.dealsText }, items: all.filter((p) => facts(p).was), target, crumbs: [home, { label: t.deals, target }], index: true };
  }

  /** Products of the scope that pass every filter except `skip` (facet counts ignore their own facet). */
  function filtered(items, filters, skip = null) {
    return items.filter((p) => {
      if (skip !== 'categories' && filters.categories.length && !filters.categories.some((key) => inCategory(p, key))) return false;
      if (skip !== 'brands' && filters.brands.length && !filters.brands.includes(p.brand?.slug)) return false;
      if (skip !== 'options' && filters.options.length && !filters.options.includes(`color-${facts(p).color}`)) return false;
      if (skip !== 'inStock' && filters.inStock && !p.inStock) return false;
      if (skip !== 'price' && filters.priceMin !== null && !(p.price && p.price.amount >= filters.priceMin)) return false;
      if (skip !== 'price' && filters.priceMax !== null && !(p.price && p.price.amount <= filters.priceMax)) return false;
      return true;
    });
  }

  function optionsFacet({ key, label, display, filterKey, filters, candidates, values }) {
    const out = [];
    for (const value of values) {
      const count = candidates.filter(value.matches).length;
      const selected = filters[filterKey].includes(value.id);
      if (!count && !selected) continue;
      out.push({
        label: value.label,
        selected,
        count,
        color: value.color ?? null,
        image: value.image ?? null,
        query: queryOf({ ...filters, [filterKey]: toggled(filters[filterKey], value.id) }),
      });
    }
    return out.length ? { key, label, kind: 'options', display, values: out, range: null } : null;
  }

  function facetsOf(scope, filters, locale) {
    const t = TEXT[locale];
    const facets = [];

    // categories: the next level under the scope (top level for other scopes)
    const depth = scope.category ? scope.category.split('/').length + 1 : 1;
    const childKeys = [...categories.keys()].filter((key) => key.split('/').length === depth && (!scope.category || key.startsWith(`${scope.category}/`)));
    facets.push(
      optionsFacet({
        key: 'category',
        label: t.category,
        display: 'list',
        filterKey: 'categories',
        filters,
        candidates: filtered(scope.items, filters, 'categories'),
        values: childKeys.map((key) => ({ id: key, label: categories.get(key).name[locale], matches: (p) => inCategory(p, key) })),
      }),
    );

    if (scope.type !== 'brand') {
      facets.push(
        optionsFacet({
          key: 'brand',
          label: t.brand,
          display: 'image',
          filterKey: 'brands',
          filters,
          candidates: filtered(scope.items, filters, 'brands'),
          values: brands[locale].map((tile) => ({ id: tile.target.slug, label: tile.name, image: tile.image?.url ?? null, matches: (p) => p.brand?.slug === tile.target.slug })),
        }),
      );
    }

    facets.push(
      optionsFacet({
        key: 'color',
        label: t.color,
        display: 'color',
        filterKey: 'options',
        filters,
        candidates: filtered(scope.items, filters, 'options'),
        values: Object.entries(COLORS).map(([id, color]) => ({ id: `color-${id}`, label: color[locale], color: color.hex, matches: (p) => facts(p).color === id })),
      }),
    );

    const priced = filtered(scope.items, filters, 'price').filter((p) => p.price);
    if (priced.length || filters.priceMin !== null || filters.priceMax !== null) {
      const amounts = priced.map((p) => p.price.amount);
      facets.push({
        key: 'price',
        label: t.price,
        kind: 'range',
        display: 'list',
        values: [],
        range: {
          min: amounts.length ? shopper.money(Math.min(...amounts), locale) : null,
          max: amounts.length ? shopper.money(Math.max(...amounts), locale) : null,
          selectedMin: filters.priceMin,
          selectedMax: filters.priceMax,
          query: queryOf({ ...filters, priceMin: null, priceMax: null }),
        },
      });
    }

    const stock = filtered(scope.items, filters, 'inStock');
    const inStockCount = stock.filter((p) => p.inStock).length;
    if (inStockCount || filters.inStock) {
      facets.push({
        key: 'availability',
        label: t.availability,
        kind: 'options',
        display: 'list',
        values: [{ label: t.inStock, selected: filters.inStock, count: inStockCount, color: null, image: null, query: queryOf({ ...filters, inStock: !filters.inStock }) }],
        range: null,
      });
    }
    return facets.filter(Boolean);
  }

  function chipsOf(facets, filters, locale) {
    const t = TEXT[locale];
    const chips = [];
    for (const facet of facets) {
      for (const value of facet.values) if (value.selected) chips.push({ label: value.label, removeQuery: value.query });
    }
    if (filters.priceMin !== null || filters.priceMax !== null) {
      const min = filters.priceMin === null ? null : priceText(filters.priceMin, locale);
      const max = filters.priceMax === null ? null : priceText(filters.priceMax, locale);
      chips.push({ label: min && max ? `${min} – ${max}` : min ? t.priceFrom(min) : t.priceTo(max), removeQuery: queryOf({ ...filters, priceMin: null, priceMax: null }) });
    }
    return chips;
  }

  function sorted(items, sort, locale) {
    const copy = [...items];
    const amount = (p) => p.price?.amount ?? Number.MAX_SAFE_INTEGER;
    if (sort === 'price_asc') copy.sort((a, b) => amount(a) - amount(b));
    if (sort === 'price_desc') copy.sort((a, b) => amount(b) - amount(a));
    if (sort === 'name_asc') copy.sort((a, b) => a.name.localeCompare(b.name, locale));
    return copy;
  }

  function listing(query, locale) {
    const t = TEXT[locale];
    const read = readFilters(query, t);
    const fields = { ...(read.fields ?? {}) };
    const page = positiveInt(query, 'page', 1, Number.MAX_SAFE_INTEGER, t, fields);
    const perPage = positiveInt(query, 'perPage', PER_PAGE, MAX_PER_PAGE, t, fields);
    if (Object.keys(fields).length) return [422, { error: { code: 'validation_failed', message: t.invalid, fields } }];

    const scope = scopeOf(query, locale);
    if (!scope) return [404, { error: { code: 'not_found', message: t.notFound } }];
    if (scope.invalid) return [422, { error: { code: 'validation_failed', message: scope.invalid, fields: { scope: [scope.invalid] } } }];

    const { filters } = read;
    const matching = sorted(filtered(scope.items, filters), filters.sort, locale);
    const facets = facetsOf(scope, filters, locale);
    const total = matching.length;
    const filteredOrSorted = hasFilters(filters) || filters.sort !== 'featured' || page > 1;
    const alternates = ['en', 'ar'].map((l) => ({ locale: l, target: scope.target }));

    return [
      200,
      {
        data: {
          context: { type: scope.type, title: scope.title, description: scope.description ?? null, image: scope.image ?? null, query: scope.query ?? null },
          breadcrumbs: scope.crumbs,
          items: matching.slice((page - 1) * perPage, page * perPage),
          pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
          sort: SORTS.map((sort) => ({ label: t.sort[sort], selected: sort === filters.sort, query: queryOf({ ...filters, sort }) })),
          facets,
          appliedFilters: chipsOf(facets, filters, locale),
          clearFiltersQuery: hasFilters(filters) ? queryOf(noFilters(filters)) : null,
          seo: {
            title: scope.title,
            description: scope.description ? `${scope.title} · ${t.storeName}` : null,
            canonical: scope.target,
            alternates,
            index: scope.index && !filteredOrSorted,
            // seo + marketing: breadcrumbs, structured data, rel=prev/next, preview (scripts/mock/seo-extras.mjs)
            ...listingSeoExtras(scope, matching.slice((page - 1) * perPage, page * perPage), page, Math.ceil(total / perPage)),
          },
        },
      },
    ];
  }

  function suggestions(query, locale) {
    const t = TEXT[locale];
    const q = (query.get('q') ?? '').trim();
    if (!q) return [422, { error: { code: 'validation_failed', message: t.qRequired, fields: { q: [t.qRequired] } } }];
    const limit = Math.min(20, Math.max(1, Number(query.get('limit')) || SUGGESTIONS));
    const needle = q.toLocaleLowerCase();
    const found = products(locale).filter((p) => p.name.toLocaleLowerCase().includes(needle) || (p.brand?.name ?? '').toLocaleLowerCase().includes(needle));
    return [200, { data: { query: q, products: found.slice(0, limit), viewAll: { type: 'search', query: q } } }];
  }

  function categoryTree(locale) {
    const build = (parent) =>
      [...categories.entries()]
        .filter(([key, node]) => node.path.length === (parent ? parent.split('/').length + 1 : 1) && (!parent || key.startsWith(`${parent}/`)))
        .map(([key, node]) => ({
          id: key,
          name: node.name[locale],
          image: node.image ? { url: node.image, alt: node.name[locale] } : (categoryImages[locale].get(key) ?? null),
          target: categoryTarget(key),
          children: build(key),
        }));
    return { items: build('') };
  }

  function brandsPage(query, locale) {
    const t = TEXT[locale];
    const fields = {};
    const page = positiveInt(query, 'page', 1, Number.MAX_SAFE_INTEGER, t, fields);
    const perPage = positiveInt(query, 'perPage', BRANDS_PER_PAGE, 100, t, fields);
    if (Object.keys(fields).length) return [422, { error: { code: 'validation_failed', message: t.invalid, fields } }];
    const all = brands[locale];
    return [200, { data: { items: all.slice((page - 1) * perPage, page * perPage), pagination: { page, perPage, total: all.length, totalPages: Math.ceil(all.length / perPage) } } }];
  }

  function resolve(query, locale) {
    const t = TEXT[locale];
    const requested = query.get('path');
    if (!requested) return [422, { error: { code: 'validation_failed', message: t.pathRequired, fields: { path: [t.pathRequired] } } }];
    const pathname = requested.split('?')[0].replace(/\/+$/, '');
    const match = pathname.match(/^\/(en|ar)(\/.*)?$/);
    const answer = (data) => [200, { data }];
    const notFound = { result: 'not_found', target: null, url: null, permanent: false };
    if (!match) return answer(notFound);
    const [, pathLocale, rest = ''] = match;

    // The old storefront's product URLs: /{locale}/product/{id or slug in either language}[/...]
    const old = rest.match(/^\/product\/(.+)$/);
    if (old) {
      const segments = old[1].split('/').map((s) => decodeURIComponent(s));
      const found = [...shopper.products('en'), ...shopper.products('ar')].find((p) => segments.some((s) => s === String(p.id) || s === p.slug));
      const target = found ? shopper.product(found.id, pathLocale)?.target : null;
      return answer(target ? { result: 'target', target, url: null, permanent: true } : notFound);
    }
    const row = REDIRECTS[rest];
    if (!row) {
      // the old storefront's brand-images page by brand id → the brand page; unknown id → not found
      const brandId = rest.match(/^\/brand\/(\d+)$/);
      if (brandId) {
        const brand = readJson(`brands.${pathLocale}.json`).items.find((item) => String(item.id) === brandId[1]);
        return answer(brand ? { result: 'target', target: brand.target, url: null, permanent: true } : notFound);
      }
      // dropped old pages (the blog, "under construction") → home
      if (/^\/(blog(\/.*)?|under-construction)$/.test(rest)) return answer({ result: 'target', target: { type: 'home' }, url: null, permanent: true });
      return answer(notFound);
    }
    return answer({ ...row, url: row.url ? row.url.replace('{locale}', pathLocale) : null });
  }

  return {
    handle({ method, pathname, query, locale }) {
      if (method !== 'GET') return null;
      if (pathname === '/products') return listing(query, locale);
      if (pathname === '/search/suggestions') return suggestions(query, locale);
      if (pathname === '/categories') return [200, { data: categoryTree(locale) }];
      if (pathname === '/brands') return brandsPage(query, locale);
      if (pathname === '/resolve') return resolve(query, locale);
      return null;
    },
  };
}
