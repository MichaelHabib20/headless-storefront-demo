import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Wishlist and compare pages against the stateful mock API (scripts/mock/shopper.mjs).
 * "test-customer" is the seeded customer: 3 wishlist items, 2 compared products (max 4).
 */
const API = MOCK_API;
const live = process.env.E2E_LIVE === '1';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/' }]);
}

/** The price text the mock API sends for the newest wishlist item. */
async function firstWishlistPrice(request: APIRequestContext, locale: 'en' | 'ar'): Promise<string> {
  const response = await request.get(`${API}/api/customer/v3/wishlist`, { headers: { Authorization: 'Bearer test-customer', 'Accept-Language': locale } });
  return (await response.json()).data.items[0].price.display;
}

/** What the mock API holds for the seeded customer right now. */
async function customerState(request: APIRequestContext) {
  const response = await request.get(`${API}/api/customer/v3/me`, { headers: { Authorization: 'Bearer test-customer' } });
  return (await response.json()).data as { counts: { cart: number; wishlist: number; compare: number }; cartQuantities: Record<string, number>; wishlistProductIds: number[]; compareProductIds: number[] };
}

test.describe('wishlist and compare', () => {
  test.skip(live, 'relies on the mock API state');

  test.beforeEach(async ({ page, request }) => {
    await request.post(`${API}/__reset`);
    await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
  });

  test.describe('signed in', () => {
    test.beforeEach(async ({ context }) => signIn(context));

    test('wishlist shows the saved products', async ({ page, request }) => {
      const errors = collectErrors(page);
      await page.goto('/en/wishlist');

      await expect(page.getByRole('heading', { level: 1, name: 'My wishlist' })).toBeVisible();
      await expect(page.getByText('Saved items: 3')).toBeVisible();
      const items = page.getByTestId('wishlist-item');
      await expect(items).toHaveCount(3);
      await expect(items.first().getByTestId('product-price')).toHaveText(await firstWishlistPrice(request, 'en'));
      await expect(items.first().getByRole('link')).toHaveAttribute('href', /^\/en\/p\/.+/);
      await expect(page.getByTestId('pagination')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });

    test('removes a product from the wishlist', async ({ page, request }) => {
      await page.goto('/en/wishlist');
      const items = page.getByTestId('wishlist-item');
      await expect(items).toHaveCount(3);
      const name = await items.first().getByRole('heading').innerText();

      await items.first().getByRole('button', { name: /^Remove/ }).click();
      await expect(page.getByTestId('wishlist-status')).toContainText('Removed from your wishlist.');
      await expect(items).toHaveCount(2);
      await expect(page.getByText('Saved items: 2')).toBeVisible();
      await expect(page.getByTestId('wishlist-grid')).not.toContainText(name);
      expect((await customerState(request)).counts.wishlist).toBe(2);

      await page.reload();
      await expect(page.getByTestId('wishlist-item')).toHaveCount(2);
    });

    test('moves a product to the cart', async ({ page, request }) => {
      const before = await customerState(request);
      await page.goto('/en/wishlist');
      const items = page.getByTestId('wishlist-item');
      await expect(items).toHaveCount(3);

      await items.first().getByRole('button', { name: /^Move to cart/ }).click();
      const status = page.getByTestId('wishlist-status');
      await expect(status).toContainText('Moved to your cart.');
      await expect(status.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en/cart');
      await expect(items).toHaveCount(2);

      const after = await customerState(request);
      expect(after.counts.wishlist).toBe(2);
      expect(after.counts.cart).toBe(before.counts.cart + 1);
      const moved = before.wishlistProductIds.find((id) => !after.wishlistProductIds.includes(id));
      expect(after.cartQuantities[String(moved)]).toBe(1);
    });

    test('pages through the wishlist', async ({ page }) => {
      // The mock catalogue is smaller than the default page size; use a small page.
      await page.goto('/en/wishlist?perPage=2');
      const nav = page.getByRole('navigation', { name: 'Wishlist pages' });
      await expect(page.getByTestId('wishlist-item')).toHaveCount(2);
      await expect(nav.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');

      await nav.getByRole('link', { name: 'Next' }).click();
      await expect(page).toHaveURL(/\/en\/wishlist\?page=2&perPage=2$/);
      await expect(page.getByTestId('wishlist-item')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

      await nav.getByRole('link', { name: 'Previous' }).click();
      await expect(page).toHaveURL(/\/en\/wishlist\?perPage=2$/);
      await expect(page.getByTestId('wishlist-item')).toHaveCount(2);
    });

    test('goes back to the last page when the current one is past the end', async ({ page }) => {
      await page.goto('/en/wishlist?page=5&perPage=2');
      await expect(page).toHaveURL(/\/en\/wishlist\?page=2&perPage=2$/);
      await expect(page.getByTestId('wishlist-item')).toHaveCount(1);

      // removing the only item of the last page lands on the previous page
      await page.getByTestId('wishlist-item').getByRole('button', { name: /^Remove/ }).click();
      await expect(page).toHaveURL(/\/en\/wishlist\?perPage=2$/);
      await expect(page.getByTestId('wishlist-item')).toHaveCount(2);
    });

    test('compare shows the products side by side', async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto('/en/compare');

      await expect(page.getByRole('heading', { level: 1, name: 'Compare products' })).toBeVisible();
      await expect(page.getByTestId('compare-note')).toHaveText('Comparing 2 of 4 products');
      await expect(page.getByTestId('compare-product')).toHaveCount(2);

      const rows = page.getByTestId('compare-row');
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(0).getByRole('rowheader')).toHaveText('Brand');
      await expect(rows.nth(1).locator('td').first()).toHaveText('BEAUTY STORES');
      const material = rows.nth(2);
      await expect(material.getByRole('rowheader')).toHaveText('Material');
      await expect(material.locator('td').first()).toContainText('—');
      await expect(material.locator('td').nth(1)).toHaveText(/^Ref \d+$/);
      expect(errors).toEqual([]);
    });

    test('removes a product from compare', async ({ page, request }) => {
      await page.goto('/en/compare');
      const products = page.getByTestId('compare-product');
      await expect(products).toHaveCount(2);

      await products.first().getByRole('button', { name: /^Remove/ }).click();
      await expect(page.getByTestId('compare-status')).toContainText('Removed from compare.');
      await expect(products).toHaveCount(1);
      await expect(page.getByTestId('compare-note')).toHaveText('Comparing 1 of 4 products');
      expect((await customerState(request)).counts.compare).toBe(1);

      await products.first().getByRole('button', { name: /^Remove/ }).click();
      await expect(page.getByRole('heading', { name: 'Nothing to compare yet' })).toBeVisible();
      await expect(page.getByRole('table')).toHaveCount(0);
    });

    test('Arabic pages are right-to-left', async ({ page, request }) => {
      const errors = collectErrors(page);
      await page.goto('/ar/wishlist');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByRole('heading', { level: 1, name: 'قائمة المفضلة' })).toBeVisible();
      await expect(page.getByTestId('wishlist-item')).toHaveCount(3);
      await expect(page.getByTestId('wishlist-item').first().getByRole('button', { name: /^نقل إلى السلة/ })).toBeVisible();
      await expect(page.getByTestId('wishlist-item').first().getByTestId('product-price')).toHaveText(await firstWishlistPrice(request, 'ar'));

      // the remove button sits in the top-left corner of the card in RTL
      const item = await page.getByTestId('wishlist-item').first().boundingBox();
      const remove = await page.getByTestId('wishlist-item').first().getByRole('button', { name: /^إزالة/ }).boundingBox();
      expect(remove!.x - item!.x).toBeLessThan(item!.width / 2);

      await page.goto('/ar/compare');
      await expect(page.getByRole('heading', { level: 1, name: 'مقارنة المنتجات' })).toBeVisible();
      await expect(page.getByTestId('compare-note')).toHaveText('مقارنة ٢ من ٤ منتجات');
      const brand = page.getByTestId('compare-row').first();
      await expect(brand.getByRole('rowheader')).toHaveText('الماركة');
      // attribute names are on the right, values to their left
      const header = await brand.getByRole('rowheader').boundingBox();
      const value = await brand.locator('td').first().boundingBox();
      expect(header!.x).toBeGreaterThan(value!.x);
      expect(errors).toEqual([]);
    });

    test('the compare table scrolls inside its box on a phone', async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 839 });
      await page.goto('/en/compare');
      const scroller = page.getByTestId('compare-scroller');
      await expect(scroller).toBeVisible();
      expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });

  test.describe('guest', () => {
    test('sees empty states and no session is created', async ({ page, context }) => {
      const errors = collectErrors(page);
      await page.goto('/en/wishlist');
      await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
      await expect(page.getByTestId('wishlist-empty').getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/en');
      await expect(page.getByTestId('wishlist-item')).toHaveCount(0);

      await page.goto('/en/compare');
      await expect(page.getByRole('heading', { name: 'Nothing to compare yet' })).toBeVisible();
      await expect(page.getByTestId('compare-empty').getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/en');

      await page.goto('/ar/wishlist');
      await expect(page.getByRole('heading', { name: 'قائمة المفضلة فارغة' })).toBeVisible();
      await page.goto('/ar/compare');
      await expect(page.getByRole('heading', { name: 'لا توجد منتجات للمقارنة' })).toBeVisible();

      expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain('sc_guest');
      expect(errors).toEqual([]);
    });

    test('an unknown token shows the empty state too', async ({ page, context }) => {
      await context.addCookies([{ name: 'sc_token', value: 'expired-token', domain: '127.0.0.1', path: '/' }]);
      await page.goto('/en/wishlist');
      await expect(page.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
      await page.goto('/en/compare');
      await expect(page.getByRole('heading', { name: 'Nothing to compare yet' })).toBeVisible();
    });
  });
});
