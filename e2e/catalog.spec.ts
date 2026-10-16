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

type TreeNode = { id: string; name: string; target: { path: string[] }; children: TreeNode[] };

async function categoryTree(request: APIRequestContext, locale = 'en'): Promise<TreeNode[]> {
  const response = await request.get(`${MOCK_API}/api/customer/v3/categories`, { headers: { 'Accept-Language': locale } });
  return (await response.json()).data.items;
}

/** The store's side filters off (the backend's ENABLE_SEARCH_SIDE_FILTERS): listings send `facets: []`. */
async function sideFiltersOff(request: APIRequestContext) {
  await request.post(`${MOCK_API}/__mode`, { data: { sideFilters: false } });
}

const COLOGNE = ['every-day-essentials', 'body-fresheners', 'body-cologne'];

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

  test('deals of one category: /product/deals/{cat} and the old /products/deals/{name} send deals + category', async ({ page, request }) => {
    const data = await listing(request, 'deals=true&category=mom-baby');
    const all = await listing(request, 'deals=true');
    expect(data.items.length).toBeLessThan(all.items.length);
    for (const url of ['/en/product/deals/mom-baby', '/en/products/deals/mom-baby']) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1, name: data.context.title })).toBeVisible();
      await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(data.items.length);
      // canonical: the deals Target with its category, at the old chips' address
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/product\/deals\/mom-baby$/);
      // the crumb back to all deals
      await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Deals', exact: true })).toHaveAttribute('href', '/en/products/deals');
    }
    // filters stay on the page's own address
    await page.getByTestId('facet-value').first().click();
    await expect(page).toHaveURL(/\/en\/products\/deals\/mom-baby\?/);

    // a category the backend does not know: all the deals (the old site never answered 404 there)
    expect((await page.goto('/en/product/deals/no-such-category'))?.status()).toBe(200);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(all.items.length);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/products\/deals$/);
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

  test('Categories and Sub category come from the category tree, even with no facets (side filters off)', async ({ page, request }) => {
    await sideFiltersOff(request);
    expect((await listing(request, `category=${COLOGNE.join('/')}`)).facets).toEqual([]);
    const tree = await categoryTree(request);
    const category = tree.find((node) => node.target.path[0] === COLOGNE[0])!;
    const group = category.children.find((node) => node.target.path[1] === COLOGNE[1])!;
    const sub = group.children.find((node) => node.target.path[2] === COLOGNE[2])!;
    const errors = collectErrors(page);
    await page.goto(`/en/product/${COLOGNE.join('/')}`);

    const filters = page.getByTestId('listing-filters');
    await expect(filters).toBeVisible();
    await expect(filters.getByTestId('facet')).toHaveCount(0);
    const categories = filters.locator('[data-section="categories"]');
    const subs = filters.locator('[data-section="sub-categories"]');
    await expect(categories.locator('summary')).toHaveText('Categories');
    await expect(categories.getByTestId('category-filter-value')).toHaveCount(tree.length);
    await expect(categories.locator('[data-selected="true"]')).toHaveText(new RegExp(category.name));
    // on a sub-category page the section is open with the group and the sub ticked
    await expect(subs).toHaveAttribute('open', '');
    await expect(subs.locator('summary')).toHaveText('Sub category');
    await expect(subs.locator('[data-selected="true"]')).toHaveCount(2);
    await expect(subs.getByRole('link', { name: sub.name })).toHaveAttribute('href', `/en/product/${category.target.path.join('/')}`);

    // another sub-category: its own listing; another category: its listing, its own groups
    const other = group.children.find((node) => node.id !== sub.id) ?? category.children.find((node) => node.id !== group.id)!;
    await subs.getByRole('link', { name: other.name, exact: true }).click();
    await expect(page).toHaveURL(`/en/product/${other.target.path.join('/')}`);
    await expect(subs.locator('[data-selected="true"]').filter({ hasText: other.name })).toHaveCount(1);
    const next = tree.find((node) => node.id !== category.id && node.children.length)!;
    await categories.getByRole('link', { name: next.name, exact: true }).click();
    await expect(page).toHaveURL(`/en/product/${next.target.path.join('/')}`);
    await expect(categories.locator('[aria-current="page"]')).toHaveText(new RegExp(next.name));
    await expect(subs).not.toHaveAttribute('open', '');
    expect(errors).toEqual([]);
  });

  test('the tree sections on other listings: search, all products, deals, brand show Categories; a custom list none', async ({ page, request }) => {
    await sideFiltersOff(request);
    const tree = await categoryTree(request);
    for (const path of ['/en/products?search=cologne', '/en/all-products', '/en/products/deals', '/en/product/brand/johnson-johnson']) {
      await page.goto(path);
      const filters = page.getByTestId('listing-filters');
      await expect(filters.locator('[data-section="categories"] [data-testid="category-filter-value"]'), path).toHaveCount(tree.length);
      await expect(filters.locator('[data-section="categories"] [data-selected="true"]'), path).toHaveCount(0);
      await expect(filters.locator('[data-section="sub-categories"]'), path).toHaveCount(0);
    }
    await page.goto('/en/products/list/best-sellers');
    await expect(page.getByTestId('listing-grid')).toBeVisible();
    await expect(page.getByTestId('category-filter')).toHaveCount(0);
  });

  test('with the backend facets on, they stay; its category facet replaces Sub category', async ({ page }) => {
    await page.goto(`/en/product/${COLOGNE.slice(0, 2).join('/')}`);
    const filters = page.getByTestId('listing-filters');
    await expect(filters.locator('[data-section="categories"]')).toBeVisible();
    await expect(filters.locator('[data-section="sub-categories"]')).toHaveCount(0);
    await expect(filters.locator('[data-testid="facet"][data-facet="category"]')).toBeVisible();
    await expect(filters.locator('[data-testid="facet"][data-facet="price"]')).toBeVisible();
  });

  test('Arabic: the tree sections in Arabic, right to left', async ({ page, request }) => {
    await sideFiltersOff(request);
    const tree = await categoryTree(request, 'ar');
    const category = tree.find((node) => node.target.path[0] === COLOGNE[0])!;
    await page.goto(`/ar/product/${COLOGNE.join('/')}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    const filters = page.getByTestId('listing-filters');
    await expect(filters.locator('[data-section="categories"] summary')).toHaveText('فئات');
    await expect(filters.locator('[data-section="sub-categories"] summary')).toHaveText('تصنيف فرعي للفئات');
    await expect(filters.locator('[data-section="categories"] [data-selected="true"]')).toHaveText(new RegExp(category.name));
    const filterBox = (await filters.boundingBox())!;
    const resultsBox = (await page.getByTestId('listing-grid').boundingBox())!;
    expect(filterBox.x).toBeGreaterThan(resultsBox.x); // the sidebar is on the right in RTL
  });

  test('side filters off: Search and Price are there like the old storefront; Price applies and clears, the sort stays', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto('/en/product/mom-baby?sort=high');
    const filters = page.getByTestId('listing-filters');
    const search = filters.getByTestId('listing-search');
    const price = filters.getByTestId('price-filter');
    await expect(search.getByRole('heading', { name: 'Search' })).toBeVisible();
    await expect(price.getByRole('heading', { name: 'Price' })).toBeVisible();
    // the old order: Search, Price, Categories, Sub category
    const y = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y;
    expect(await y(search)).toBeLessThan(await y(price));
    expect(await y(price)).toBeLessThan(await y(filters.locator('[data-section="categories"]')));
    await expect(filters.getByTestId('facet')).toHaveCount(0); // the API sent no facets: no Brands either, like the old site

    await price.getByRole('spinbutton', { name: 'From' }).fill('100');
    await price.getByRole('spinbutton', { name: 'To' }).fill('190');
    await price.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high&price_from=100&price_to=190$/);
    const data = await listing(request, 'category=mom-baby&sort=price_desc&priceMin=100&priceMax=190');
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(data.items.length);
    await expect(page.getByTestId('price-filter').getByRole('spinbutton', { name: 'From' })).toHaveValue('100');

    await page.getByTestId('price-filter').getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high$/);
    await expect(page.getByTestId('price-filter').getByRole('spinbutton', { name: 'From' })).toHaveValue('');
  });

  test('the Search box searches inside the category (old storefront): same URL + search=, kept by sort and pages', async ({ page, request }) => {
    const category = await listing(request, 'category=mom-baby');
    const inside = await listing(request, 'category=mom-baby&q=bath');
    expect(inside.pagination.total).toBeLessThan(category.pagination.total);
    await page.goto('/en/product/mom-baby?sort=high');
    const box = page.getByTestId('listing-search').getByRole('searchbox', { name: 'Search in the products' });
    await box.fill('bath');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high&search=bath$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(category.context.title);
    await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${inside.pagination.total}`);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(inside.items.length);
    await expect(page.getByTestId('listing-search').getByRole('searchbox')).toHaveValue('bath');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    // the backend's sort links carry no q: the page keeps search= on them
    await page.getByTestId('sort').locator('summary').click();
    await page.getByTestId('sort').getByRole('link', { name: inside.sort.find((s) => s.query === 'sort=price_asc')!.label }).click();
    await expect(page).toHaveURL('/en/product/mom-baby?search=bath&sort=low');
    await expect(page.getByTestId('listing-count')).toHaveText(`Results: ${inside.pagination.total}`);

    // pages keep it too
    await page.goto('/en/product/mom-baby?search=bath&perPage=2');
    await page.getByRole('navigation', { name: 'Result pages' }).getByRole('link', { name: 'Page 2' }).click();
    await expect(page).toHaveURL('/en/product/mom-baby?search=bath&perPage=2&page=2');
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(Math.min(2, inside.pagination.total - 2));
  });

  test('searching inside a brand and the deals keeps their page', async ({ page, request }) => {
    const brand = await listing(request, 'brand=johnson-johnson&q=bath');
    await page.goto('/en/product/brand/johnson-johnson');
    await page.getByTestId('listing-search').getByRole('searchbox').fill('bath');
    await page.getByTestId('listing-search').getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL('/en/product/brand/johnson-johnson?search=bath');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(brand.context.title);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(brand.items.length);

    const deals = await listing(request, 'deals=true&q=bath');
    await page.goto('/en/products/deals?search=bath');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(deals.context.title);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(deals.items.length);
  });

  test('the search page: the Search box changes the text and keeps the sort', async ({ page }) => {

    await page.goto('/en/products?search=cologne&sort=low&page=2');
    const again = page.getByTestId('listing-search').getByRole('searchbox', { name: 'Search in the products' });
    await expect(again).toHaveValue('cologne');
    await again.fill('johnson');
    await page.getByTestId('listing-search').getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/\/en\/products\?sort=low&search=johnson$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search results for "johnson"');
  });

  test('switching the language keeps the sort, the page and the filters', async ({ page, request }) => {
    const data = await listing(request, 'category=mom-baby');
    const query = `sort=high&price_from=10${data.pagination.totalPages > 1 ? '&page=2' : ''}`;
    await page.goto(`/en/product/mom-baby?${query}`);
    await page.waitForLoadState('networkidle');
    const toArabic = page.getByRole('link', { name: 'Switch language' }).first();
    await expect(toArabic).toHaveAttribute('href', `/ar/product/mom-baby?${query}`);
    await toArabic.click();
    await expect(page).toHaveURL(`/ar/product/mom-baby?${query}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('link', { name: 'تغيير اللغة' }).first()).toHaveAttribute('href', `/en/product/mom-baby?${query}`);
  });

  test('a product picture that does not load shows the store placeholder on the cards', async ({ page }) => {
    await page.route(/\.(webp|jpe?g|png)(\?|$)/i, (route) => route.fulfill({ status: 404, body: '' }));
    await page.goto('/en/product/mom-baby');
    await page.waitForLoadState('networkidle');
    const images = page.getByTestId('listing-grid').getByTestId('product-card').locator('img');
    expect(await images.count()).toBeGreaterThan(0);
    for (const img of await images.all()) {
      await expect(img).toHaveAttribute('data-placeholder', 'true');
      expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)).toBe(true); // no broken-image icon
    }
  });

  test('Arabic: Search and Price in Arabic, right to left, Latin digits like the prices', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto('/ar/product/mom-baby');
    const price = page.getByTestId('price-filter');
    await expect(page.getByTestId('listing-search').getByRole('heading', { name: 'بحث' })).toBeVisible();
    await expect(price.getByRole('heading', { name: 'السعر' })).toBeVisible();
    await price.getByRole('spinbutton', { name: 'من' }).fill('50');
    await price.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page).toHaveURL(/\/ar\/product\/mom-baby\?price_from=50&price_to=$/);
    await expect(page.getByTestId('price-filter').getByRole('link', { name: 'إزالة' })).toHaveAttribute('href', '/ar/product/mom-baby');
    await expect(page.getByTestId('listing-count')).toHaveText(/^النتائج: [0-9,]+$/);
    const filterBox = (await page.getByTestId('listing-filters').boundingBox())!;
    expect(filterBox.x).toBeGreaterThan((await page.getByTestId('listing-grid').boundingBox())!.x);
  });

  test('Arabic: search inside a category', async ({ page, request }) => {
    const text = 'شامبو';
    const inside = await listing(request, `category=mom-baby&q=${encodeURIComponent(text)}`, 'ar');
    await page.goto('/ar/product/mom-baby');
    await page.getByTestId('listing-search').getByRole('searchbox').fill(text);
    await page.getByTestId('listing-search').getByRole('button', { name: 'بحث' }).click();
    await expect(page).toHaveURL(`/ar/product/mom-baby?search=${encodeURIComponent(text)}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(inside.context.title);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(inside.items.length);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card').first()).toContainText(text);
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

  test('with no facets the drawer still opens with the category sections', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto(`/en/product/${COLOGNE.join('/')}`);
    expect(await fitsScreen(page)).toBe(true);
    await page.getByRole('button', { name: 'Filters' }).click();
    const drawer = page.getByRole('dialog', { name: 'Filters' });
    await expect(drawer.locator('[data-section="categories"]')).toBeVisible();
    await expect(drawer.locator('[data-section="sub-categories"]')).toBeVisible();
    const tree = await categoryTree(request);
    const next = tree.find((node) => node.target.path[0] !== COLOGNE[0])!;
    await drawer.getByRole('link', { name: next.name, exact: true }).click();
    await expect(page).toHaveURL(`/en/product/${next.target.path.join('/')}`);
  });

  test('Search and Price in the phone drawer (Arabic, no facets)', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto('/ar/product/mom-baby?sort=low');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'الفلاتر' }).click();
    const drawer = page.getByRole('dialog', { name: 'الفلاتر' });
    await expect(drawer.getByTestId('listing-search')).toBeVisible();
    await drawer.getByRole('spinbutton', { name: 'إلى' }).fill('190');
    await drawer.getByRole('button', { name: 'تطبيق' }).click();
    await expect(page).toHaveURL(/\/ar\/product\/mom-baby\?sort=low&price_from=&price_to=190$/);
    await expect(page.getByTestId('price-filter').getByRole('spinbutton', { name: 'إلى' })).toHaveValue('190');
    expect(await fitsScreen(page)).toBe(true);
  });

  test('searching inside a category from the phone drawer (Arabic) keeps the sort', async ({ page, request }) => {
    await sideFiltersOff(request);
    const text = 'شامبو';
    const inside = await listing(request, `category=mom-baby&q=${encodeURIComponent(text)}&sort=price_asc`, 'ar');
    await page.goto('/ar/product/mom-baby?sort=low');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'الفلاتر' }).click();
    const drawer = page.getByRole('dialog', { name: 'الفلاتر' });
    await drawer.getByTestId('listing-search').getByRole('searchbox').fill(text);
    await drawer.getByTestId('listing-search').getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(`/ar/product/mom-baby?sort=low&search=${encodeURIComponent(text)}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(inside.context.title);
    await expect(page.getByTestId('listing-grid').getByTestId('product-card')).toHaveCount(inside.items.length);
    expect(await fitsScreen(page)).toBe(true);
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

  test('Search and Price are GET forms', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto('/en/product/mom-baby?sort=high');
    const price = page.getByTestId('price-filter');
    await price.getByRole('spinbutton', { name: 'From' }).fill('100');
    await price.getByRole('button', { name: 'Apply' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high&price_from=100&price_to=$/);
    await page.getByTestId('price-filter').getByRole('link', { name: 'Clear' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high$/);

    await page.getByTestId('listing-search').getByRole('searchbox').fill('bath');
    await page.getByTestId('listing-search').getByRole('button', { name: 'Go' }).click();
    await expect(page).toHaveURL(/\/en\/product\/mom-baby\?sort=high&search=bath$/);
    await expect(page.getByTestId('listing-grid')).toBeVisible();
    await resetMock(page);
  });

  test('the category sections are plain links', async ({ page, request }) => {
    await sideFiltersOff(request);
    await page.goto(`/en/product/${COLOGNE.join('/')}`);
    const categories = page.locator('[data-section="categories"]');
    await expect(categories).toBeVisible();
    const tree = await categoryTree(request);
    const next = tree.find((node) => node.target.path[0] !== COLOGNE[0])!;
    await categories.getByRole('link', { name: next.name, exact: true }).click();
    await expect(page).toHaveURL(`/en/product/${next.target.path.join('/')}`);
    await resetMock(page);
  });
});
