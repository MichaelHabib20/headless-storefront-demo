import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { APP_URL, MOCK_API } from './support';

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
      expect((website.potentialAction as Json).target).toEqual({ '@type': 'EntryPoint', urlTemplate: `${APP_URL}/${locale}/search?q={search_term_string}` });
      expect(byType(graphs, 'Pharmacy')!.openingHoursSpecification).toHaveLength(2);
      for (const url of ourUrls(graphs)) expect(url.startsWith(`${APP_URL}/`)).toBe(true);
    });

    test(`product: Product + Offer from the backend, BreadcrumbList from Seo.breadcrumbs (${locale})`, async ({ page, request }) => {
      const slug = (await api<{ items: { slug: string }[] }>(request, 'products?perPage=1', locale)).items[0].slug;
      const details = await api<{ seo: { breadcrumbs: { label: string }[]; structuredData: { product: Json } }; product: { slug: string } }>(request, `products/${encodeURIComponent(slug)}`, locale);
      await page.goto(`/${locale}/p/${encodeURIComponent(details.product.slug)}`);
      const graphs = await jsonLd(page);

      const product = byType(graphs, 'Product')!;
      expect(product.name).toBe(details.seo.structuredData.product.name);
      expect(product.url).toBe(`${APP_URL}/${locale}/p/${encodeURIComponent(details.product.slug)}`);
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
        expect(String(items[0].url)).toMatch(new RegExp(`^${APP_URL.replace(/\./g, '\\.')}/${locale}/p/`));
        expect(byType(graphs, 'BreadcrumbList')).toBeTruthy();
      }
      const listing = await api<{ seo: { structuredData: { collection: { name: string } } } }>(request, 'products?category=mom-baby', locale);
      expect(byType(await jsonLd(page), 'CollectionPage')!.name).toBe(listing.seo.structuredData.collection.name);
    });
  }
});

test.describe('head tags', () => {
  test('rel=prev/next from Seo.pagination, noindex where the backend says so', async ({ page }) => {
    await page.goto('/en/search?perPage=2');
    await expect(page.locator('head link[rel="next"]')).toHaveAttribute('href', '/en/search?page=2');
    await expect(page.locator('head link[rel="prev"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    await page.goto('/en/search?perPage=2&page=2');
    await expect(page.locator('head link[rel="prev"]')).toHaveAttribute('href', '/en/search');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await page.goto('/ar/search?q=baby');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  test('Open Graph and Twitter cards, og:type product, absolute canonical, Google verification on home', async ({ page, request }) => {
    const slug = (await api<{ items: { slug: string }[] }>(request, 'products?perPage=1')).items[0].slug;
    await page.goto(`/en/p/${encodeURIComponent(slug)}`);
    await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'product');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https?:\/\//);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${APP_URL}/en/p/${encodeURIComponent(slug)}`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${APP_URL}/en/p/${encodeURIComponent(slug)}`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', /summary/);

    await page.goto('/ar');
    await expect(page.locator('meta[name="google-site-verification"]')).toHaveAttribute('content', 'mock-google-verification-1');
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ar_EG');
    await expect(page).toHaveTitle('اى وقت واى مكان');
  });

  test('the private pages answer X-Robots-Tag: noindex', async ({ request }) => {
    for (const path of ['/en/cart', '/ar/checkout', '/en/account/orders', '/en/sign-in']) {
      const res = await request.get(`${APP_URL}${path}`, { maxRedirects: 0 });
      expect(res.headers()['x-robots-tag'], path).toContain('noindex');
    }
    expect((await request.get(`${APP_URL}/en`)).headers()['x-robots-tag']).toBeUndefined();
  });
});

test.describe('robots.txt and sitemaps', () => {
  test('robots.txt keeps private pages out and points at the sitemap; a hidden store disallows everything', async ({ request }) => {
    const robots = await (await request.get(`${APP_URL}/robots.txt`)).text();
    expect(robots).toContain('Disallow: /en/cart');
    expect(robots).toContain('Disallow: /ar/checkout');
    expect(robots).toContain(`Sitemap: ${APP_URL}/sitemap.xml`);

    await request.post(`${MOCK_API}/__seo`, { data: { robotsIndex: false } });
    const hidden = await (await request.get(`${APP_URL}/robots.txt`)).text();
    expect(hidden).toMatch(/Disallow: \/\s*$/m);
    expect(hidden).not.toContain('Sitemap:');
    expect(await (await request.get(`${APP_URL}/sitemap.xml`)).text()).not.toContain('<sitemap>');
  });

  test('sitemap index → child sitemaps with both languages, under the test origin', async ({ request }) => {
    const index = await request.get(`${APP_URL}/sitemap.xml`);
    expect(index.headers()['content-type']).toContain('application/xml');
    const children = [...(await index.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const type of ['products', 'categories', 'brands', 'pages', 'landing_pages', 'tags']) {
      expect(children).toContain(`${APP_URL}/sitemaps/${type}-en-1.xml`);
      expect(children).toContain(`${APP_URL}/sitemaps/${type}-ar-1.xml`);
    }

    const products = await (await request.get(`${APP_URL}/sitemaps/products-ar-1.xml`)).text();
    const locs = [...products.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(5);
    for (const loc of locs) expect(loc.startsWith(`${APP_URL}/ar/p/`)).toBe(true);
    expect(products).toContain('hreflang="en"');
    expect(products).toContain('<lastmod>');

    const categories = await (await request.get(`${APP_URL}/sitemaps/categories-en-1.xml`)).text();
    expect(categories).toContain(`<loc>${APP_URL}/en/c/`);
    expect((await request.get(`${APP_URL}/sitemaps/orders-en-1.xml`)).status()).toBe(404);
    expect((await request.get(`${APP_URL}/sitemaps/products-en-99.xml`)).status()).toBe(404);
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
    await page.goto(`/en/p/${encodeURIComponent(details.product.slug)}`);
    await page.waitForLoadState('networkidle');

    const buy = page.getByTestId('product-info').getByRole('group', { name: details.product.name, exact: true });
    await buy.getByRole('button', { name: 'Add to cart' }).click();
    await expect(buy.getByText('Added to cart.')).toBeVisible();
    await expect.poll(async () => (await events(request)).filter((e) => e.name === 'add_to_cart')).toHaveLength(1);
    const [added] = (await events(request)).filter((e) => e.name === 'add_to_cart');
    expect(added.productIds).toEqual([productId]);
    expect(added.token).toMatch(/^guest-/);
    expect(added).not.toHaveProperty('price');
    // the page view went out too, with the same product
    expect((await events(request)).some((e) => e.name === 'view_item' && e.productIds?.includes(productId))).toBe(true);
  });

  test('a campaign click id is kept and sent with the events', async ({ page, request, context }) => {
    await page.goto('/en/search?q=baby&fbclid=IwAR-test.1');
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
    await expect(page).toHaveURL(/\/en\/checkout\/result\?checkout=/);
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
