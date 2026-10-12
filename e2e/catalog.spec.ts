import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { APP_URL, MOCK_API, acceptCookies, live, resetMock } from './support';

/**
 * Listings, search, categories, brands and unknown paths against the mock API
 * (scripts/mock/catalog.mjs). Assertions compare the page with what the API sent.
 */
type Listing = {
  context: { title: string };
  items: Array<{ name: string; price: { display: string; compareAtDisplay: string | null } | null }>;
  pagination: { total: number; totalPages: number };
  facets: Array<{ key: string; values: Array<{ label: string; query: string; count: number | null }> }>;
  sort: Array<{ label: string; query: string }>;
};

async function listing(request: APIRequestContext, query: string, locale = 'en'): Promise<Listing> {
  const response = await request.get(`${MOCK_API}/api/customer/v3/products?${query}`, { headers: { 'Accept-Language': locale } });
  return (await response.json()).data;
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

const fitsScreen = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('catalog', () => {
  test.skip(live, 'needs the mock API catalog');

  test.beforeEach(async ({ page }) => {
    await resetMock(page);
    await acceptCookies(page);
  });

  test('a category shows what the API sent: heading, text, crumbs, products, prices, count', async ({ page, request }) => {
    const errors = collectErrors(page);
    const data = await listing(request, 'category=mom-baby');
    await page.goto('/en/product/mom-baby');

    await expect(page.getByRole('heading', { level: 1, name: data.context.title })).toBeVisible();
    await expect(page.getByTestId('listing-description')).toContainText('mom and baby');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
    await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${data.pagination.total}`);
    const cards = page.getByTestId('listing-grid').getByTestId('product-card');
    await expect(cards).toHaveCount(data.items.length);
    await expect(cards.first().getByTestId('product-price')).toContainText(data.items[0].price!.display);
    expect(await page.title()).toContain(data.context.title);
    expect(errors).toEqual([]);
  });

  test('filters are links the backend wrote, in the old storefront names: select, chip, remove, clear all', async ({ page, request }) => {
    const data = await listing(request, 'category=mom-baby');
    const lavender = data.facets.find((f) => f.key === 'color')!.values.find((v) => v.label === 'Lavender')!;
    expect(lavender.query).toBe('options=color-lavender');
    await page.goto('/en/product/mom-baby');

    await page.getByTestId('facet-value').filter({ hasText: 'Lavender' }).click();
    await expect(page).toHaveURL('/en/product/mom-baby?options_values_ids=color-lavender');
    await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${lavender.count}`);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(lavender.count!);
    await expect(page.getByTestId('facet-value').filter({ hasText: 'Lavender' })).toHaveAttribute('data-selected', 'true');

    // a second filter, then remove the first one with its chip
    await page.getByTestId('facet-value').filter({ hasText: 'In stock only' }).click();
    await expect(page.getByTestId('applied-filter')).toHaveCount(2);
    await page.getByRole('link', { name: 'Remove filter: Lavender' }).click();
    await expect(page.getByTestId('applied-filter')).toHaveCount(1);
    await expect(page).toHaveURL('/en/product/mom-baby?in_stock=1');

    await page.getByRole('link', { name: 'Clear all', exact: true }).click();
    await expect(page).toHaveURL('/en/product/mom-baby');
    await expect(page.getByTestId('applied-filters')).toHaveCount(0);
    await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${data.pagination.total}`);
  });

  test('sorts with the backend sort links and pages keep the query', async ({ page, request }) => {
    const data = await listing(request, '');
    const byPrice = data.sort.find((s) => s.query === 'sort=price_desc')!;
    const sorted = await listing(request, byPrice.query);
    await page.goto('/en/products');

    await page.getByTestId('sort').locator('summary').click();
    await page.getByTestId('sort').getByRole('link', { name: byPrice.label }).click();
    await expect(page).toHaveURL('/en/products?sort=high');
    await expect(page.getByTestId('listing-grid').getByTestId('product-card').first()).toContainText(sorted.items[0].name);

    const pages = page.getByRole('navigation', { name: 'Result pages' });
    await pages.getByRole('link', { name: 'Page 2' }).click();
    await expect(page).toHaveURL('/en/products?sort=high&page=2');
    const second = await listing(request, `${byPrice.query}&page=2`);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(second.items.length);
  });

  test('the price range form sends price_from/price_to next to the other filters', async ({ page }) => {
    await page.goto('/en/product/mom-baby?options_values_ids=color-lavender');
    const form = page.getByTestId('range-form');
    await form.getByRole('spinbutton', { name: 'From' }).fill('100');
    await form.getByRole('spinbutton', { name: 'To' }).fill('190');
    await form.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?options_values_ids=color-lavender&price_from=100&price_to=190$/);
    await expect(page.getByTestId('applied-filter').filter({ hasText: '100 EGP – 190 EGP' })).toBeVisible();
    await expect(page.getByTestId('range-form').getByRole('spinbutton', { name: 'From' })).toHaveValue('100');
  });

  test('search keeps q on filter links, and a search without results says so', async ({ page }) => {
    await page.goto('/en/products?search=cologne');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search results for "cologne"');
    await page.getByTestId('facet-value').filter({ hasText: 'Pink' }).click();
    await expect(page).toHaveURL(/\/en\/products\?search=cologne&options_values_ids=color-pink$/);

    await page.goto('/en/products?search=zzzz');
    await expect(page.getByTestId('listing-empty')).toContainText('No products found');
    await page.getByTestId('listing-empty').getByRole('link', { name: 'Browse all products' }).click();
    await expect(page).toHaveURL(/\/en\/all-products$/);
  });

  test('all products (the old /all-products): the listing with no scope, its canonical, both languages', async ({ page, request }) => {
    for (const locale of ['en', 'ar'] as const) {
      const data = await listing(request, '', locale);
      const response = await page.goto(`/${locale}/all-products`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: data.context.title })).toBeVisible();
      await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(data.items.length);
      // the backend's canonical Target {type: search, query: ""} is this page
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${locale}/all-products$`));
      expect(await fitsScreen(page)).toBe(true);
    }
    // filters and pages stay on /all-products
    await page.goto('/en/all-products');
    await page.getByTestId('facet-value').first().click();
    await expect(page).toHaveURL(/\/en\/all-products\?/);
  });

  test('every listing route: brand, list, tag, deals (with old prices from the API)', async ({ page, request }) => {
    for (const [url, query] of [
      ['/en/product/brand/johnson-johnson', 'brand=johnson-johnson'],
      ['/en/products/list/125', 'list=125'],
      ['/en/products/tag/new-arrivals', 'tag=new-arrivals'],
      ['/en/products/deals', 'deals=true'],
    ]) {
      const data = await listing(request, query);
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: data.context.title })).toBeVisible();
      await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(data.items.length);
    }
    const deals = await listing(request, 'deals=true');
    await expect(page.getByTestId('product-price').first()).toContainText(deals.items[0].price!.compareAtDisplay!);

    await page.goto('/en/product/brand/bioderma');
    await expect(page.getByTestId('listing-empty')).toBeVisible();
  });

  test('unknown scopes are 404, refused filters show the backend message', async ({ page }) => {
    expect((await page.goto('/en/product/no-such-category'))?.status()).toBe(404);
    expect((await page.goto('/en/product/brand/no-such-brand'))?.status()).toBe(404);
    await page.goto('/en/product/mom-baby?price_from=abc');
    await expect(page.getByTestId('listing-invalid')).toContainText('Some filters are not valid.');
    await page.goto('/en/product/mom-baby?priceMin=abc');
    await expect(page.getByTestId('listing-invalid')).toContainText('Some filters are not valid.');
    await page.getByRole('link', { name: 'Show everything' }).click();
    await expect(page).toHaveURL('/en/product/mom-baby');
  });

  test('old filter URLs and v3 filter URLs open the same listing; its links use the old names', async ({ page, request }) => {
    const data = await listing(request, 'category=mom-baby&options=color-lavender&inStock=true&sort=price_desc');
    for (const url of [
      '/en/product/mom-baby?options_values_ids=color-lavender&in_stock=1&sort=high',
      '/en/product/mom-baby?options=color-lavender&inStock=true&sort=price_desc',
    ]) {
      await page.goto(url);
      await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${data.pagination.total}`);
      await expect(page.getByTestId('applied-filter')).toHaveCount(2);
      await expect(page.getByTestId('facet-value').filter({ hasText: 'Lavender' })).toHaveAttribute('data-selected', 'true');
      const hrefs = await page.locator('a[rel="nofollow"]').evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) expect(href).not.toMatch(/[?&](brands|categories|options|inStock|priceMin|priceMax)=|sort=(price|name|rating)_/);
      await expect(page.getByRole('link', { name: 'Remove filter: Lavender' })).toHaveAttribute('href', '/en/product/mom-baby?in_stock=1&sort=high');
    }
  });

  test('Arabic listing', async ({ page, request }) => {
    const data = await listing(request, 'category=mom-baby', 'ar');
    await page.goto('/ar/product/mom-baby');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: data.context.title })).toBeVisible();
    await expect(page.getByTestId('listing-grid').getByTestId('product-price').first()).toContainText(data.items[0].price!.display);
    await expect(page.getByTestId('sort').locator('summary')).toContainText('ترتيب حسب');
    expect(await fitsScreen(page)).toBe(true);
  });

  test('categories and brands pages', async ({ page }) => {
    await page.goto('/en/categories');
    await expect(page.getByRole('heading', { level: 1, name: 'All categories' })).toBeVisible();
    await page.getByTestId('category-tree').getByRole('link', { name: 'Baby Toiletries & Bath Accessories' }).click();
    await expect(page).toHaveURL('/en/product/mom-baby/baby-care/baby-toiletries-bath-accessories');
    await expect(page.getByTestId('listing-grid').getByTestId('product-card').first()).toBeVisible();

    await page.goto('/en/brands');
    await expect(page.getByTestId('brand-grid').getByRole('link')).toHaveCount(24);
    await page.getByRole('navigation', { name: 'Brand pages' }).getByRole('link', { name: 'Page 2' }).click();
    await expect(page).toHaveURL('/en/brands?page=2');
    await expect(page.getByTestId('brand-grid').getByRole('link')).toHaveCount(1);
  });

  test('header search: suggestions while typing, keyboard, view all, submit', async ({ page }) => {
    await page.goto('/en');
    const box = page.getByRole('combobox', { name: 'Search' });
    await box.pressSequentially('cologne', { delay: 30 });
    const list = page.getByRole('listbox', { name: 'Suggestions' });
    await expect(list.getByRole('option').first()).toContainText('Cologne');
    await expect(box).toHaveAttribute('aria-expanded', 'true');

    await box.press('ArrowUp'); // the last option: view all
    await box.press('Enter');
    await expect(page).toHaveURL('/en/products?search=cologne');

    await box.fill('');
    await box.pressSequentially('bath', { delay: 30 });
    await expect(list.getByRole('option').first()).toBeVisible();
    await box.press('ArrowDown');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/en\/.+/);

    await page.goto('/ar');
    await page.getByRole('combobox', { name: 'بحث' }).fill('جونسون');
    await page.getByRole('combobox', { name: 'بحث' }).press('Enter');
    await expect(page).toHaveURL(`/ar/products?search=${encodeURIComponent('جونسون')}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('جونسون');
  });

  test('suggestions never create a guest session', async ({ page, context }) => {
    await page.goto('/en');
    await page.getByRole('combobox', { name: 'Search' }).pressSequentially('bath', { delay: 30 });
    await expect(page.getByRole('listbox', { name: 'Suggestions' }).getByRole('option').first()).toBeVisible();
    expect((await context.cookies()).some((c) => c.name === 'sc_guest')).toBe(false);
  });
});

test.describe('unknown paths', () => {
  test.skip(live, 'needs the mock API redirect table');

  test('old storefront URLs redirect permanently to our own URL of their Target', async ({ request }) => {
    const response = await request.get('/en/products/old-name/36480', { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(new URL(response.headers().location, APP_URL).pathname).toBe('/en/jj-baby-bedtime-bath-125ml-lavendercamomile');
  });

  test('dropped old pages: brand images by id → the brand page; the blog and "under construction" → home', async ({ request }) => {
    for (const [path, to] of [
      ['/en/brand/758', '/en/product/brand/bioderma'],
      ['/ar/brand/758', '/ar/product/brand/bioderma'],
      ['/en/blog', '/en'],
      ['/ar/blog/some-article', '/ar'],
      ['/en/under-construction', '/en'],
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(301);
      expect(new URL(response.headers().location, APP_URL).pathname, path).toBe(to);
    }
    expect((await request.get('/en/brand/999999', { maxRedirects: 0 })).status()).toBe(404);
  });

  test('redirect-table rows: temporary to a Target, permanent to an external url', async ({ request }) => {
    const toDeals = await request.get('/en/summer-sale', { maxRedirects: 0 });
    expect(toDeals.status()).toBe(302);
    expect(new URL(toDeals.headers().location, APP_URL).pathname).toBe('/en/products/deals');

    const external = await request.get('/en/our-blog', { maxRedirects: 0 });
    expect(external.status()).toBe(301);
    expect(external.headers().location).toBe('https://blog.example.com/');
  });

  test('a gone path answers 410 with a page', async ({ page }) => {
    await acceptCookies(page);
    const response = await page.goto('/ar/discontinued-offer');
    expect(response?.status()).toBe(410);
    await expect(page.getByRole('heading', { name: 'هذه الصفحة لم تعد متاحة' })).toBeVisible();
  });

  test('broken rows never loop or leave the site unsafely; everything else is 404', async ({ page, request }) => {
    for (const path of ['/en/self-redirect', '/en/unsafe-redirect', '/en/nothing-here', '/en/product/x.html']) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
    }
    const response = await page.goto('/en/nothing-here');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('a visitor cannot fake the gone answer', async ({ request }) => {
    const response = await request.get('/en/nothing-here', { headers: { 'x-storefront-resolution': 'gone' } });
    expect(response.status()).toBe(404);
  });
});

test.describe('catalog on a phone', () => {
  test.skip(live, 'needs the mock API catalog');
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await resetMock(page);
    await acceptCookies(page);
  });

  test('filters open in a drawer, a value applies, the drawer closes', async ({ page }) => {
    await page.goto('/en/product/mom-baby');
    expect(await fitsScreen(page)).toBe(true);
    await expect(page.getByTestId('listing-filters')).toBeHidden();

    await page.getByRole('button', { name: 'Filters' }).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer).toBeVisible();
    await drawer.getByTestId('facet-value').filter({ hasText: 'Blue' }).click();
    await expect(page).toHaveURL(/options_values_ids=color-blue/);
    await expect(drawer.getByTestId('facet-value').filter({ hasText: 'Blue' })).toHaveAttribute('data-selected', 'true');
    await drawer.getByRole('button', { name: 'Show results' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByTestId('applied-filter')).toHaveCount(1);
  });

  test('the header search box is on screen and suggests', async ({ page }) => {
    await page.goto('/ar');
    const box = page.getByRole('combobox', { name: 'بحث' });
    await expect(box).toBeVisible();
    await box.pressSequentially('johnson', { delay: 30 });
    await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    expect(await fitsScreen(page)).toBe(true);
  });
});

test.describe('filters without JavaScript', () => {
  test.skip(live, 'needs the mock API catalog');
  test.use({ javaScriptEnabled: false, viewport: { width: 360, height: 780 } });

  test('show in the page and work as links', async ({ page }) => {
    await page.goto('/en/product/mom-baby');
    await expect(page.getByTestId('listing-filters')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filters' })).toBeHidden();
    await page.getByTestId('facet-value').filter({ hasText: 'Lavender' }).click();
    await expect(page).toHaveURL(/options_values_ids=color-lavender/);
    await expect(page.getByTestId('applied-filter')).toHaveCount(1);
  });
});
