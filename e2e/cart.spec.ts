import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Cart page against the stateful mock API (scripts/mock/shopper.mjs): "test-customer" has
 * 2 lines (18 × 2 and 160 × 1 = 196 EGP) and the store minimum order is 300 EGP.
 * The money texts ("196.00 EGP", "196.00 جنية"), the messages and the progress (65%) are the mock
 * backend's, written like the real one: the page must show them as they are.
 */

test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API');

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/' }]);
}

async function openCart(page: Page, locale: 'en' | 'ar') {
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
  await page.goto(`/${locale}/cart`);
  // Buttons only work once the page is hydrated.
  await page.waitForLoadState('networkidle');
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__reset`);
});

test.describe('cart page', () => {
  test('shows the signed-in cart with the minimum-order blocker', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(context);
    await openCart(page, 'en');

    await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(2);
    await expect(lines.first()).toContainText('J&J Baby Bedtime Bath');
    await expect(lines.first().getByTestId('cart-quantity')).toHaveText('2');
    await expect(lines.first().getByRole('link', { name: /J&J Baby Bedtime Bath/ })).toHaveAttribute('href', /^\/en\/.+/);

    await expect(page.getByTestId('cart-subtotal')).toHaveText('196.00 EGP');
    await expect(page.getByTestId('cart-total')).toHaveText('196.00 EGP');
    await expect(page.getByTestId('checkout-blockers')).toContainText('The minimum order is 300.00 EGP. Add 104.00 EGP more to check out.');
    await expect(page.getByTestId('cart-minimum-remaining')).toHaveText('104.00 EGP');
    await expect(page.getByTestId('cart-minimum-bar')).toHaveAttribute('style', /--cart-progress:\s*65%/);
    await expect(page.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    await expect(page.getByRole('link', { name: 'Checkout' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('changing a quantity updates the totals from the API', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'en');

    const second = page.getByTestId('cart-line').nth(1);
    await expect(second.getByTestId('cart-quantity')).toHaveText('1');
    await second.getByRole('button', { name: 'Increase quantity' }).click();

    await expect(second.getByTestId('cart-quantity')).toHaveText('2');
    await expect(page.getByTestId('cart-total')).toHaveText('356.00 EGP');
    await expect(second.getByTestId('cart-line-total')).toHaveText(/^Item total\s*320 EGP$/);
    await expect(page.getByTestId('checkout-blockers')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');

    // The change lives in the backend, not just in the page.
    await page.reload();
    await expect(page.getByTestId('cart-total')).toHaveText('356.00 EGP');
  });

  test('removes an item', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'en');

    const lines = page.getByTestId('cart-line');
    await lines.first().getByRole('button', { name: 'Remove' }).click();

    await expect(lines).toHaveCount(1);
    await expect(lines.first()).toContainText('No More Tangles');
    await expect(page.getByTestId('cart-total')).toHaveText('160.00 EGP');
  });

  test('clears the cart after confirmation', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'en');

    await page.getByRole('button', { name: 'Clear cart' }).click();
    await page.getByRole('button', { name: 'Yes, clear it' }).click();

    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
  });

  test('a guest sees an empty cart and no session is created', async ({ page, context }) => {
    await openCart(page, 'en');

    await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
    const empty = page.getByTestId('cart-empty');
    await expect(empty.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    await expect(empty.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/en');
    await expect(page.getByTestId('cart-summary')).toHaveCount(0);
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_guest')).toBe(false);
  });

  test('renders right-to-left Arabic', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { level: 1, name: 'سلة التسوق' })).toBeVisible();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await expect(page.getByTestId('cart-total')).toHaveText('196.00 جنية');
    await expect(page.getByTestId('checkout-blockers')).toContainText('الحد الأدنى للطلب 300.00 جنية. أضف 104.00 جنية لإتمام الطلب.');
    await expect(page.getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByTestId('cart-line').nth(1).getByRole('button', { name: 'زيادة الكمية' }).click();
    await expect(page.getByTestId('cart-total')).toHaveText('356.00 جنية');
    await expect(page.getByRole('link', { name: 'إتمام الطلب' })).toHaveAttribute('href', '/ar/checkout');
  });

  test('a missing product picture shows the store placeholder, not the broken-image icon; quantities in Latin digits (ar)', async ({ page, context }) => {
    await signIn(context);
    await page.route(/\.(webp|jpe?g|png)(\?|$)/i, (route) => route.fulfill({ status: 404, body: '' }));
    await openCart(page, 'ar');
    const images = page.getByTestId('cart-line').locator('img');
    await expect(images).toHaveCount(2);
    for (const img of await images.all()) {
      await expect(img).toHaveAttribute('data-placeholder', 'true');
      expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    }
    // the quantity uses the same digits as the money texts ("196.00 جنية")
    await expect(page.getByTestId('cart-quantity').first()).toHaveText(/^[0-9.]+$/);
    expect(await page.getByTestId('cart-line').first().innerText()).not.toMatch(/[٠-٩]/);
  });

  test('says so when the store API is down', async ({ page, context, request }) => {
    await signIn(context);
    await request.post(`${MOCK_API}/__mode`, { data: { fail: true } });
    try {
      await page.goto('/en/cart');
      await expect(page.getByRole('heading', { name: 'The store is taking a break' })).toBeVisible();
      await expect(page.getByTestId('cart-line')).toHaveCount(0);
    } finally {
      await request.post(`${MOCK_API}/__mode`, { data: { fail: false } });
    }
  });
});
