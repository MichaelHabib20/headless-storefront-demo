import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { APP_URL, live } from './support';

/**
 * The old storefront's URLs, served unchanged (backend docs/headless/url-parity-plan.md): pages at
 * their old address, the old server's 301s, the interim URLs moved to the old ones, the merchant's
 * redirect table on our own pages.
 */
test.skip(live, 'needs the mock API');

type Locale = 'en' | 'ar';
const product = (locale: Locale) =>
  (JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data.sections as { products: { id: number; slug: string }[] }[]).flatMap((s) => s.products)[0];

const get = (request: import('@playwright/test').APIRequestContext, path: string) => request.get(`${APP_URL}${path}`, { maxRedirects: 0 });

test.describe('the old storefront URLs', () => {
  test('pages answer 200 at their old address', async ({ request }) => {
    const slug = encodeURIComponent(product('en').slug);
    for (const path of [
      `/en/${slug}`,
      '/en/product/mom-baby',
      '/en/products?search=cologne',
      '/en/products',
      '/en/products/deals',
      '/en/product/deals/mom-baby',
      '/ar/product/deals/mom-baby',
      '/en/products/deals/mom-baby',
      '/en/products/list/125',
      '/en/all-products',
      '/en/categories',
      '/en/all-categories',
      '/en/brands',
      '/en/pages/about-us',
      '/en/privacy-policy',
      '/en/terms-and-conditions',
      '/en/cookie-policy',
      '/en/cart',
      '/en/favorites',
      '/en/compare',
      '/en/session/signin',
      '/en/session',
      '/en/session/signup',
      '/en/session/forgot-password',
      '/en/account/track-your-order',
      '/en/checkout/final-receipt',
    ]) {
      expect((await get(request, path)).status(), path).toBe(200);
    }
  });

  test('a product page is the product, and links go to the old addresses', async ({ page }) => {
    const { slug } = product('en');
    await page.goto(`/en/${encodeURIComponent(slug)}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/en/${encodeURIComponent(slug)}$`));
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/ar\//);

    await page.goto('/en');
    const footer = page.locator('footer');
    await expect(footer.locator('a[href="/en/privacy-policy"]').first()).toBeVisible();
  });

  test('the old category view renders at its own address (/category/..., /category-view)', async ({ page, request }) => {
    for (const path of ['/en/category', '/en/category/mom-baby', '/en/category/mom-baby/baby-care', '/en/category-view', '/ar/category/mom-baby']) {
      expect((await get(request, path)).status(), path).toBe(200);
    }
    expect((await get(request, '/en/category/no-such-category')).status()).toBe(404);

    await page.goto('/en/category/mom-baby');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/category\/mom-baby$/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/en\/category\/mom-baby$/);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/ar\/category\/mom-baby$/);
    await expect(page.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/en/product/mom-baby');
    await expect(page.locator('[data-testid="category-tree"] a[href="/en/product/mom-baby/baby-care"]').first()).toBeVisible();
  });

  test('the old server redirects: bare paths, old product links', async ({ request }) => {
    const bare = await get(request, '/products?search=x');
    expect(bare.status()).toBe(301);
    expect(bare.headers().location).toMatch(/\/en\/products\?search=x$/);

    const old = await get(request, `/en/products/old-name/${product('en').id}`);
    expect(old.status()).toBe(301);
    expect(old.headers().location).toBe(`/en/${encodeURIComponent(product('en').slug)}`);
  });

  test('the interim URLs move to the old ones (301)', async ({ request }) => {
    const slug = encodeURIComponent(product('en').slug);
    for (const [from, to] of [
      [`/en/p/${slug}`, `/en/${slug}`],
      ['/en/c/mom-baby?page=2', '/en/product/mom-baby?page=2'],
      ['/en/deals', '/en/products/deals'],
      ['/en/search?q=cologne', '/en/products?search=cologne'],
      ['/en/wishlist', '/en/favorites'],
      ['/en/sign-in?next=%2Fen%2Fcart', '/en/session/signin?returnUrl=%2Fen%2Fcart'],
      ['/en/account/orders', '/en/account/order-history'],
      ['/en/checkout/result?checkout=x', '/en/checkout/final-receipt?checkout=x'],
    ]) {
      const response = await get(request, from);
      expect(response.status(), from).toBe(301);
      expect(new URL(response.headers().location, APP_URL).pathname + new URL(response.headers().location, APP_URL).search, from).toBe(to);
    }
  });

  test("the merchant's redirect table applies to our own pages too", async ({ request }) => {
    const moved = await get(request, '/en/products/tag/old-tag');
    expect(moved.status()).toBe(301);
    expect(moved.headers().location).toMatch(/\/en\/products\/deals$/);

    const gone = await get(request, '/en/product/retired-category');
    expect(gone.status()).toBe(410);
    expect(await gone.text()).toContain('no longer available');
  });

  test('old account aliases: /orders/... shows the account pages, retired pages go to the account', async ({ request }) => {
    const alias = await get(request, '/en/orders/order-history');
    expect(alias.status()).toBe(200);
    expect(alias.headers()['x-robots-tag']).toContain('noindex');

    const retired = await get(request, '/en/account/cards');
    expect(retired.status()).toBe(302);
    expect(retired.headers().location).toMatch(/\/en\/account$/);
  });
});
