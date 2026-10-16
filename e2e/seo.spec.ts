import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { APP_URL, MOCK_API, SITE_APP_URL, SITE_HOST, SITE_URL } from './support';

/**
 * SEO + marketing against the mock API (scripts/mock/seo.mjs): JSON-LD from the backend's Seo and
 * GET /seo/site, head tags, robots.txt, sitemaps, marketing tags after cookie consent, and the
 * server-side events (POST /events, read back from GET /__events).
 */
test.skip(process.env.E2E_LIVE === '1', 'needs the mock API state');

const API = `${MOCK_API}/api/customer/v3`;
const LOCALES = ['en', 'ar'] as const;
const TAG_HOSTS = /googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|facebook\.com\/tr|analytics\.tiktok\.com|sc-static\.net|clarity\.ms|hotjar\.com/;

type Json = Record<string, unknown>;
interface MockEvent {
  name: string;
  eventId?: string;
  productIds?: number[];
  orderId?: string | null;
  searchTerm?: string | null;
  token: string | null;
}

async function api<T>(request: APIRequestContext, path: string, locale = 'en'): Promise<T> {
  const res = await request.get(`${API}/${path}`, { headers: { 'Accept-Language': locale } });
  return ((await res.json()) as { data: T }).data;
}

async function jsonLd(page: Page): Promise<Json[]> {
  const texts = await page.locator('script[type="application/ld+json"]').allTextContents();
  return texts.map((text) => JSON.parse(text) as Json);
}

const byType = (graphs: Json[], type: string) => graphs.find((g) => g['@type'] === type);

/** Every absolute http(s) URL in a JSON-LD block that points at this storefront uses the test origin. */
function ourUrls(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string' && /^https?:\/\/127\.0\.0\.1/.test(value)) found.push(value);
  else if (Array.isArray(value)) value.forEach((v) => ourUrls(v, found));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => ourUrls(v, found));
  return found;
}

async function events(request: APIRequestContext): Promise<MockEvent[]> {
  return ((await (await request.get(`${MOCK_API}/__events`)).json()) as { events: MockEvent[] }).events;
}

async function blockTags(context: BrowserContext) {
  await context.route(TAG_HOSTS, (route) => route.abort());
}

test.beforeEach(async ({ request, context }) => {
  await request.post(`${MOCK_API}/__reset`);
  await blockTags(context);
});

test.describe('JSON-LD', () => {
  for (const locale of LOCALES) {
    test(`home: WebSite + SearchAction, Organization, LocalBusiness and the home WebPage (${locale})`, async ({ page }) => {
      await page.goto(`/${locale}`);
      const graphs = await jsonLd(page);

      expect(graphs.map((g) => g['@type']).sort()).toEqual(['Organization', 'Pharmacy', 'WebPage', 'WebSite']);
      const website = byType(graphs, 'WebSite')!;
      expect(website.url).toBe(`${APP_URL}/${locale}`);
      expect((website.potentialAction as Json).target).toEqual({ '@type': 'EntryPoint', urlTemplate: `${APP_URL}/${locale}/products?search={search_term_string}` });
      expect(byType(graphs, 'Pharmacy')!.openingHoursSpecification).toHaveLength(2);
      for (const url of ourUrls(graphs)) expect(url.startsWith(`${APP_URL}/`)).toBe(true);
    });

    test(`product: Product + Offer from the backend, BreadcrumbList from Seo.breadcrumbs (${locale})`, async ({ page, request }) => {
      const slug = (await api<{ items: { slug: string }[] }>(request, 'products?perPage=1', locale)).items[0].slug;
      const details = await api<{ seo: { breadcrumbs: { label: string }[]; structuredData: { product: Json } }; product: { slug: string } }>(request, `products/${encodeURIComponent(slug)}`, locale);
      await page.goto(`/${locale}/${encodeURIComponent(details.product.slug)}`);
      const graphs = await jsonLd(page);

      const product = byType(graphs, 'Product')!;
      expect(product.name).toBe(details.seo.structuredData.product.name);
      expect(product.url).toBe(`${APP_URL}/${locale}/${encodeURIComponent(details.product.slug)}`);
      const offer = product.offers as Json | undefined;
      if (details.seo.structuredData.product.price !== null) expect(offer).toMatchObject({ price: details.seo.structuredData.product.price, priceCurrency: details.seo.structuredData.product.currency });
      const trail = byType(graphs, 'BreadcrumbList')!.itemListElement as Json[];
      expect(trail.map((item) => item.name)).toEqual(details.seo.breadcrumbs.map((crumb) => crumb.label));
      expect(trail[0].item).toBe(`${APP_URL}/${locale}`);
      expect(trail.at(-1)).not.toHaveProperty('item');
      // the site-wide blocks are on every page
      expect(byType(graphs, 'Organization')).toBeTruthy();
    });

    test(`listing and category: CollectionPage + ItemList + BreadcrumbList (${locale})`, async ({ page, request }) => {
      for (const path of ['search', 'c/mom-baby']) {
        await page.goto(`/${locale}/${path}`);
        const graphs = await jsonLd(page);
        const collection = byType(graphs, 'CollectionPage')!;
        const items = (collection.mainEntity as { itemListElement: Json[] }).itemListElement;
        expect(items.length).toBeGreaterThan(0);
        expect(String(items[0].url)).toMatch(new RegExp(`^${APP_URL.replace(/\./g, '\\.')}/${locale}/`));
        expect(byType(graphs, 'BreadcrumbList')).toBeTruthy();
      }
      const listing = await api<{ seo: { structuredData: { collection: { name: string } } } }>(request, 'products?category=mom-baby', locale);
      expect(byType(await jsonLd(page), 'CollectionPage')!.name).toBe(listing.seo.structuredData.collection.name);
    });
  }
});

test.describe('head tags', () => {
  test('rel=prev/next from Seo.pagination, noindex where the backend says so', async ({ page }) => {
    // the unscoped listing's canonical is the all-products page (Target {type: search, query: ""})
    await page.goto('/en/all-products?perPage=2');
    await expect(page.locator('head link[rel="next"]')).toHaveAttribute('href', `${APP_URL}/en/all-products?page=2`);
    await expect(page.locator('head link[rel="prev"]')).toHaveCount(0);
    // any query but page (here perPage) is noindex, as on the old storefront
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.goto('/en/all-products');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await page.goto('/en/all-products?perPage=2&page=2');
    await expect(page.locator('head link[rel="prev"]')).toHaveAttribute('href', `${APP_URL}/en/all-products`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await page.goto('/ar/products?search=baby');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('listings: indexable without a query; noindex with any query but page, scope names typed into the URL included', async ({ page }) => {
    for (const path of ['/en/products/list/best-sellers', '/en/product/deals/mom-baby', '/en/product/mom-baby']) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), path).toHaveCount(0);
    }
    // the backend sees these and says noindex
    await page.goto('/en/product/mom-baby?utm_source=x');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    // the route gives the scope, so these never reach the backend: the storefront says noindex
    for (const path of ['/en/products/list/best-sellers?category=mom-baby', '/en/product/mom-baby?brand=x', '/en/products/deals?q=baby']) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', /noindex/);
      await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', /(^|,\s*)follow/);
    }
  });

  test('Open Graph and Twitter cards, og:type product, absolute canonical, Google verification on home', async ({ page, request }) => {
    const slug = (await api<{ items: { slug: string }[] }>(request, 'products?perPage=1')).items[0].slug;
    await page.goto(`/en/${encodeURIComponent(slug)}`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\//);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${APP_URL}/en/${encodeURIComponent(slug)}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${APP_URL}/en/${encodeURIComponent(slug)}`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', /summary/);

    await page.goto('/ar');
    await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute('content', 'mock-google-verification-1');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ar_EG');
    await expect(page).toHaveTitle('اى وقت واى مكان');
  });

  test('the private pages answer X-Robots-Tag: noindex', async ({ request }) => {
    for (const path of ['/en/cart', '/ar/checkout', '/en/account/order-history', '/en/session/signin', '/en/session/change-password', '/ar/verify-phone', '/en/account/track-your-order']) {
      const res = await request.get(`${APP_URL}${path}`, { maxRedirects: 0 });
      expect(res.headers()['x-robots-tag'], path).toContain('noindex');
    }
    expect((await request.get(`${APP_URL}/en`)).headers()['x-robots-tag']).toBeUndefined();
  });
});

const locsOf = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
/** The server with SC_SITE_URL, asked as the production host (SITE_HOST) or as a test host (127.0.0.1). */
const asProduction = { 'x-forwarded-host': SITE_HOST, 'x-forwarded-proto': 'https' };

test.describe('robots.txt and sitemaps', () => {
  test("robots.txt without SC_SITE_URL: the old storefront's rules and the sitemap of this origin; a hidden store disallows everything", async ({ request }) => {
    const robots = await (await request.get(`${APP_URL}/robots.txt`)).text();
    for (const rule of ['Allow: /*.css', 'Disallow: /*/cart$', 'Disallow: /*/checkout/', 'Disallow: /*/account/', 'Disallow: /*?*sort=', 'Disallow: /*/product/*--']) {
      expect(robots).toContain(`${rule}\n`);
    }
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain(`Sitemap: ${APP_URL}/sitemap_index.xml`);

    // staging backend / DISABLE_SEARCH_ENGINE_INDEXING: the backend says robots.index false
    await request.post(`${MOCK_API}/__seo`, { data: { robotsIndex: false } });
    const hidden = await (await request.get(`${APP_URL}/robots.txt`)).text();
    expect(hidden).toBe('User-agent: *\nDisallow: /\n');
    // the sitemap still lists what exists (robots.txt keeps crawlers out)
    expect(await (await request.get(`${APP_URL}/sitemap_index.xml`)).text()).toContain('<sitemap>');
  });

  test('SC_SITE_URL: the production host gets the rules and its own sitemap; a test host of the same deployment is blocked', async ({ request }) => {
    const production = await (await request.get(`${SITE_APP_URL}/robots.txt`, { headers: asProduction })).text();
    expect(production).toContain('Disallow: /*/checkout$\n');
    expect(production).toContain(`Sitemap: ${SITE_URL}/sitemap_index.xml\n`);
    expect(production).not.toContain('127.0.0.1');

    const testHost = await (await request.get(`${SITE_APP_URL}/robots.txt`)).text();
    expect(testHost).toBe('User-agent: *\nDisallow: /\n');
    // pages on the test host say noindex too; on the production host only the private ones do
    expect((await request.get(`${SITE_APP_URL}/en`)).headers()['x-robots-tag']).toContain('noindex');
    expect((await request.get(`${SITE_APP_URL}/en`, { headers: asProduction })).headers()['x-robots-tag']).toBeUndefined();
    expect((await request.get(`${SITE_APP_URL}/en/cart`, { headers: asProduction, maxRedirects: 0 })).headers()['x-robots-tag']).toContain('noindex');

    // the backend still wins on the production host
    await request.post(`${MOCK_API}/__seo`, { data: { robotsIndex: false } });
    expect(await (await request.get(`${SITE_APP_URL}/robots.txt`, { headers: asProduction })).text()).toBe('User-agent: *\nDisallow: /\n');
  });

  test('X-Robots-Tag on public pages: every combination of SC_SITE_URL, host and the backend', async ({ request }) => {
    const PUBLIC = ['/en', '/ar', '/en/brands', '/ar/product/mom-baby'];
    const tag = async (origin: string, path: string, headers: Record<string, string> = {}) => (await request.get(`${origin}${path}`, { headers, maxRedirects: 0 })).headers()['x-robots-tag'];

    // backend allows indexing: indexable without SC_SITE_URL and on the production host; the test host is not
    for (const path of PUBLIC) {
      expect(await tag(APP_URL, path), `no SC_SITE_URL ${path}`).toBeUndefined();
      expect(await tag(SITE_APP_URL, path, asProduction), `production ${path}`).toBeUndefined();
      expect(await tag(SITE_APP_URL, path), `test host ${path}`).toContain('noindex');
    }

    // backend says no indexing (staging, DISABLE_SEARCH_ENGINE_INDEXING): noindex everywhere, also
    // without SC_SITE_URL (the seif test host on Vercel) — the same answer as robots.txt
    await request.post(`${MOCK_API}/__seo`, { data: { robotsIndex: false } });
    for (const path of PUBLIC) {
      expect(await tag(APP_URL, path), `no SC_SITE_URL ${path}`).toContain('noindex');
      expect(await tag(SITE_APP_URL, path, asProduction), `production ${path}`).toContain('noindex');
      expect(await tag(SITE_APP_URL, path), `test host ${path}`).toContain('noindex');
    }
    expect(await (await request.get(`${APP_URL}/robots.txt`)).text()).toBe('User-agent: *\nDisallow: /\n');

    // indexing back on: a real store is indexable again (no stale noindex)
    await request.post(`${MOCK_API}/__seo`, { data: { robotsIndex: true } });
    expect(await tag(SITE_APP_URL, '/en', asProduction)).toBeUndefined();
    expect(await tag(APP_URL, '/ar')).toBeUndefined();
  });

  test("sitemap index: the old storefront's files in its order, Arabic first, under this origin", async ({ request }) => {
    const index = await request.get(`${APP_URL}/sitemap_index.xml`);
    expect(index.headers()['content-type']).toContain('application/xml');
    const children = locsOf(await index.text());
    const types = ['static_pages', 'pages', 'products', 'categories', 'subcategories', 'groups', 'brands', 'landing_pages', 'tags'];
    expect(children).toEqual(types.flatMap((type) => [`${APP_URL}/sitemap_${type}_ar.xml`, `${APP_URL}/sitemap_${type}_en.xml`]));
    expect(await (await request.get(`${APP_URL}/sitemap.xml`)).text()).toBe(await (await request.get(`${APP_URL}/sitemap_index.xml`)).text());

    // a store without ENABLE_BRANDS_IN_SITEMAPS (seif) has no brands file, like the old index
    await request.post(`${MOCK_API}/__seo`, { data: { brands: false } });
    const withoutBrands = locsOf(await (await request.get(`${APP_URL}/sitemap_index.xml`)).text());
    expect(withoutBrands.some((loc) => loc.includes('sitemap_brands_'))).toBe(false);
    expect(withoutBrands).toContain(`${APP_URL}/sitemap_groups_ar.xml`);
  });

  test('child sitemaps: real URLs of each language with both alternates and x-default (en + ar)', async ({ request }) => {
    for (const locale of LOCALES) {
      const products = await (await request.get(`${APP_URL}/sitemap_products_${locale}.xml`)).text();
      const locs = locsOf(products);
      expect(locs.length).toBeGreaterThan(5);
      for (const loc of locs) expect(loc.startsWith(`${APP_URL}/${locale}/`)).toBe(true);
      expect(products).toContain(`hreflang="en" href="${APP_URL}/en/`);
      expect(products).toContain(`hreflang="ar" href="${APP_URL}/ar/`);
      expect(products).toContain(`hreflang="x-default" href="${APP_URL}/ar/`);
      expect(products).toContain('<lastmod>');
      // every URL of the file opens (same paths as the old site)
      for (const loc of locs.slice(0, 3)) expect((await request.get(loc)).status(), loc).toBe(200);

      const statics = locsOf(await (await request.get(`${APP_URL}/sitemap_static_pages_${locale}.xml`)).text());
      expect(statics).toEqual([`${APP_URL}/${locale}/pages/contact`, `${APP_URL}/${locale}/pages/branches`, `${APP_URL}/${locale}/products/deals`]);
      expect(locsOf(await (await request.get(`${APP_URL}/sitemap_pages_${locale}.xml`)).text())).toEqual([`${APP_URL}/${locale}/pages/about-us`, `${APP_URL}/${locale}/privacy-policy`]);

      const categories = locsOf(await (await request.get(`${APP_URL}/sitemap_categories_${locale}.xml`)).text());
      expect(categories).toContain(`${APP_URL}/${locale}/product/skin-care`);
      for (const loc of categories) expect(loc).toMatch(new RegExp(`^${APP_URL}/${locale}/product/[^/]+$`));
      const subcategories = locsOf(await (await request.get(`${APP_URL}/sitemap_subcategories_${locale}.xml`)).text());
      expect(subcategories).toContain(`${APP_URL}/${locale}/product/skin-care/body-care/body-scrub`);
      expect(locsOf(await (await request.get(`${APP_URL}/sitemap_groups_${locale}.xml`)).text())).toContain(`${APP_URL}/${locale}/product/skin-care/body-care`);
      for (const loc of [categories[0], subcategories[0]]) expect((await request.get(loc)).status(), loc).toBe(200);
    }
    expect((await request.get(`${APP_URL}/sitemap_orders_en.xml`)).status()).toBe(404);
    expect((await request.get(`${APP_URL}/sitemap_products_en_1.xml`)).status()).toBe(404);
  });

  test('ENABLE_CATEGORY_VIEW: groups are listed at the old /category/... address, and those pages open', async ({ request }) => {
    await request.post(`${MOCK_API}/__seo`, { data: { categoryView: true } });
    for (const locale of LOCALES) {
      const xml = await (await request.get(`${APP_URL}/sitemap_groups_${locale}.xml`)).text();
      const groups = locsOf(xml);
      expect(groups).toContain(`${APP_URL}/${locale}/category/skin-care/body-care`);
      expect(xml).toContain(`hreflang="x-default" href="${APP_URL}/ar/category/skin-care/body-care"`);
      expect((await request.get(groups[0])).status()).toBe(200);
    }
  });

  test('SC_SITE_URL: the index and every child URL use the canonical origin, on the production and on a test host', async ({ request }) => {
    for (const headers of [asProduction, {}]) {
      const children = locsOf(await (await request.get(`${SITE_APP_URL}/sitemap_index.xml`, { headers })).text());
      expect(children[0]).toBe(`${SITE_URL}/sitemap_static_pages_ar.xml`);
      const products = await (await request.get(`${SITE_APP_URL}/sitemap_products_ar.xml`, { headers })).text();
      for (const loc of locsOf(products)) expect(loc.startsWith(`${SITE_URL}/ar/`)).toBe(true);
      expect(products).not.toContain('127.0.0.1');
    }
  });
});

test.describe('canonical, hreflang and x-default on every kind of page', () => {
  const hreflang = (page: Page, lang: string) => page.locator(`head link[rel="alternate"][hreflang="${lang}"]`);

  async function expectLinks(page: Page, path: string, origin: string, { canonical, en, ar }: { canonical: string; en: string; ar: string }) {
    await expect(page.locator('head link[rel="canonical"]'), path).toHaveAttribute('href', `${origin}${canonical}`);
    await expect(hreflang(page, 'en'), path).toHaveAttribute('href', `${origin}${en}`);
    await expect(hreflang(page, 'ar'), path).toHaveAttribute('href', `${origin}${ar}`);
    await expect(hreflang(page, 'x-default'), path).toHaveAttribute('href', `${origin}${ar}`);
    await expect(page.locator('head link[rel="canonical"]'), path).toHaveCount(1);
  }

  test('/brands and /all-categories (en + ar): self canonical, their own languages, x-default Arabic', async ({ page }) => {
    for (const locale of LOCALES) {
      for (const index of ['brands', 'all-categories', 'categories']) {
        const path = `/${locale}/${index}`;
        await page.goto(path);
        await expectLinks(page, path, APP_URL, { canonical: path, en: `/en/${index}`, ar: `/ar/${index}` });
      }
    }
    await page.goto('/ar/brands?page=2');
    await expectLinks(page, '/ar/brands?page=2', APP_URL, { canonical: '/ar/brands?page=2', en: '/en/brands?page=2', ar: '/ar/brands?page=2' });
  });

  test('home, category, product, brand, deals and CMS pages carry all three; search stays noindex', async ({ page, request }) => {
    const slug = (await api<{ items: { slug: string }[] }>(request, 'products?perPage=1')).items[0].slug;
    const arSlug = (await api<{ product: { slug: string } }>(request, `products/${encodeURIComponent(slug)}`, 'ar')).product.slug;
    const brand = 'johnson-johnson';
    const cases: Array<[string, { canonical: string; en: string; ar: string }]> = [
      ['/en', { canonical: '/en', en: '/en', ar: '/ar' }],
      ['/ar', { canonical: '/ar', en: '/en', ar: '/ar' }],
      ['/en/product/mom-baby', { canonical: '/en/product/mom-baby', en: '/en/product/mom-baby', ar: '/ar/product/mom-baby' }],
      [`/en/${encodeURIComponent(slug)}`, { canonical: `/en/${encodeURIComponent(slug)}`, en: `/en/${encodeURIComponent(slug)}`, ar: `/ar/${encodeURIComponent(arSlug)}` }],
      [`/ar/product/brand/${brand}`, { canonical: `/ar/product/brand/${brand}`, en: `/en/product/brand/${brand}`, ar: `/ar/product/brand/${brand}` }],
      ['/ar/products/deals', { canonical: '/ar/products/deals', en: '/en/products/deals', ar: '/ar/products/deals' }],
    ];
    for (const [path, links] of cases) {
      await page.goto(path);
      await expectLinks(page, path, APP_URL, links);
    }
    await page.goto('/en/pages/about-us');
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${APP_URL}/en/pages/about-us`);
    await expect(hreflang(page, 'x-default')).toHaveAttribute('href', `${APP_URL}/ar/pages/about-us`);

    await page.goto('/en/products?search=baby');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('pages without their own languages no longer claim the home page as their alternate', async ({ page }) => {
    await page.goto('/en/cart');
    await expect(hreflang(page, 'ar')).toHaveCount(0);
    await expect(hreflang(page, 'x-default')).toHaveCount(0);
  });

  test('SC_SITE_URL: canonical, hreflang, og:url, rel=next and JSON-LD use the canonical origin, on the production and on a test host', async ({ browser }) => {
    for (const headers of [asProduction, {}]) {
      const context = await browser.newContext({ baseURL: SITE_APP_URL, extraHTTPHeaders: headers });
      const page = await context.newPage();
      for (const locale of LOCALES) {
        await page.goto(`/${locale}/brands`);
        await expectLinks(page, `/${locale}/brands`, SITE_URL, { canonical: `/${locale}/brands`, en: '/en/brands', ar: '/ar/brands' });
        await page.goto(`/${locale}/product/mom-baby`);
        await expectLinks(page, `/${locale}/product/mom-baby`, SITE_URL, { canonical: `/${locale}/product/mom-baby`, en: '/en/product/mom-baby', ar: '/ar/product/mom-baby' });
        await page.goto(`/${locale}/all-products?perPage=2`);
        await expect(page.locator('head link[rel="next"]')).toHaveAttribute('href', `${SITE_URL}/${locale}/all-products?page=2`);
      }
      await page.goto('/ar');
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${SITE_URL}/ar`);
      const graphs = await jsonLd(page);
      expect(JSON.stringify(graphs)).toContain(`${SITE_URL}/ar`);
      expect(JSON.stringify(graphs)).not.toContain('127.0.0.1');
      await context.close();
    }
  });
});

test.describe('marketing tags', () => {
  test('nothing is installed before consent, then only the configured tags', async ({ page, request }) => {
    await request.post(`${MOCK_API}/__seo`, { data: { marketing: true } });
    await page.goto('/en');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('script#sc-tag-gtm')).toHaveCount(0);
    await expect(page.locator('script#sc-tag-meta')).toHaveCount(0);

    await page.getByTestId('cookie-consent').getByRole('button').click();
    await expect(page.locator('script#sc-tag-gtm')).toHaveCount(1);
    await expect(page.locator('script#sc-tag-gtag')).toHaveCount(1);
    await expect(page.locator('script#sc-tag-meta')).toHaveCount(1);
    await expect(page.locator('script#sc-tag-tiktok')).toHaveCount(1);
    // not configured in the mock: never installed
    await expect(page.locator('script#sc-tag-snapchat, script#sc-tag-clarity, script#sc-tag-hotjar')).toHaveCount(0);
    expect(await page.evaluate(() => Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer))).toBe(true);
  });

  test('a store without ids installs nothing, also after consent', async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
    await page.goto('/ar');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('script[id^="sc-tag-"]')).toHaveCount(0);
  });
});

test.describe('server-side events (POST /events)', () => {
  test('add to cart sends one add_to_cart event with the product id and the guest token', async ({ page, request }) => {
    const productId = 9822; // in stock on the mock (scripts/mock/product.mjs)
    const details = await api<{ product: { slug: string; name: string } }>(request, 'products?perPage=50').then(async (listing) => {
      const slug = (listing as unknown as { items: { id: number; slug: string }[] }).items.find((card) => card.id === productId)!.slug;
      return api<{ product: { slug: string; name: string } }>(request, `products/${encodeURIComponent(slug)}`);
    });
    await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
    await page.goto(`/en/${encodeURIComponent(details.product.slug)}`);
    await page.waitForLoadState('networkidle');

    const buy = page.getByTestId('product-info').getByRole('group', { name: details.product.name, exact: true });
    await buy.getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.getByTestId('cart-toast')).toHaveText('Added to cart.');
    await expect.poll(async () => (await events(request)).filter((e) => e.name === 'add_to_cart')).toHaveLength(1);
    const [added] = (await events(request)).filter((e) => e.name === 'add_to_cart');
    expect(added.productIds).toEqual([productId]);
    expect(added.token).toMatch(/^guest-/);
    expect(added).not.toHaveProperty('price');
    // the page view went out too, with the same product
    expect((await events(request)).some((e) => e.name === 'view_item' && e.productIds?.includes(productId))).toBe(true);
  });

  test('a campaign click id is kept and sent with the events', async ({ page, request, context }) => {
    await page.goto('/en/products?search=baby&fbclid=IwAR-test.1');
    const cookie = (await context.cookies()).find((c) => c.name === 'sc_click_ids');
    expect(cookie?.httpOnly).toBe(true);
    await expect.poll(async () => (await events(request)).find((e) => e.name === 'search')).toMatchObject({ searchTerm: 'baby', clickIds: { fbclid: 'IwAR-test.1' } });
  });

  test('purchase fires once per order on the result page (reloads included)', async ({ page, context, request }) => {
    await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
    await request.put(`${API}/cart/items/7346`, { headers: { Authorization: 'Bearer test-customer' }, data: { quantity: 2 } });
    const sent: string[] = [];
    page.on('request', (req) => {
      if (req.url().endsWith('/api/events') && req.method() === 'POST') sent.push(JSON.parse(req.postData() ?? '{}').name);
    });

    await page.goto('/en/checkout');
    await page.waitForLoadState('networkidle');
    await page.getByRole('radio', { name: 'Cash on delivery' }).check();
    await expect(page.getByTestId('checkout-updating')).toHaveCount(0);
    await page.getByTestId('checkout-terms').check();
    await page.getByTestId('place-order').click();
    await expect(page).toHaveURL(/\/en\/checkout\/final-receipt\?checkout=/);
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    await page.reload();
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    await page.waitForLoadState('networkidle');

    expect(sent.filter((name) => name === 'begin_checkout')).toHaveLength(1);
    expect(sent.filter((name) => name === 'purchase')).toHaveLength(1);
    await expect.poll(async () => (await events(request)).filter((e) => e.name === 'purchase')).toHaveLength(1);
    const [purchase] = (await events(request)).filter((e) => e.name === 'purchase');
    expect(purchase).toMatchObject({ token: 'test-customer', eventId: `purchase-${purchase.orderId}` });
  });
});
