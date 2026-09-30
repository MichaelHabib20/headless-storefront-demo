import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * Cart page against the stateful mock API (scripts/mock/shopper.mjs): "test-customer" has
 * 2 lines (EGP 18 × 2 and EGP 160 × 1 = EGP 196) and the store minimum order is EGP 300.
 */
const MOCK_API = 'http://127.0.0.1:4010';

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

    // 2 lines, 3 units: the count is the API's summary.itemCount
    await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart (3)' })).toBeVisible();
    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(2);
    await expect(lines.first()).toContainText('J&J Baby Bedtime Bath');
    await expect(lines.first().getByTestId('cart-quantity')).toHaveText('2');
    await expect(lines.first().getByRole('link', { name: /J&J Baby Bedtime Bath/ })).toHaveAttribute('href', /^\/en\/p\/.+/);

    await expect(page.getByTestId('cart-subtotal')).toHaveText('EGP 196');
    await expect(page.getByTestId('cart-total')).toHaveText('EGP 196');
    await expect(page.getByTestId('checkout-blockers')).toContainText('Add EGP 104 more to reach the minimum order.');
    await expect(page.getByTestId('cart-minimum-remaining')).toHaveText('EGP 104');
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
    await expect(page.getByTestId('cart-total')).toHaveText('EGP 356');
    await expect(page.getByTestId('cart-title')).toHaveText('Shopping cart (4)');
    await expect(second.getByTestId('cart-line-total')).toContainText('EGP 320');
    await expect(page.getByTestId('checkout-blockers')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');

    // The change lives in the backend, not just in the page.
    await page.reload();
    await expect(page.getByTestId('cart-total')).toHaveText('EGP 356');
    await expect(page.getByTestId('cart-title')).toHaveText('Shopping cart (4)');
  });

  test('removes an item', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'en');

    const lines = page.getByTestId('cart-line');
    await lines.first().getByRole('button', { name: 'Remove' }).click();

    await expect(lines).toHaveCount(1);
    await expect(lines.first()).toContainText('No More Tangles');
    await expect(page.getByTestId('cart-total')).toHaveText('EGP 160');
    await expect(page.getByTestId('cart-title')).toHaveText('Shopping cart (1)');
  });

  test('clears the cart after confirmation', async ({ page, context }) => {
    await signIn(context);
    await openCart(page, 'en');

    await page.getByRole('button', { name: 'Clear cart' }).click();
    await page.getByRole('button', { name: 'Yes, clear it' }).click();

    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('cart-line')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Shopping cart' })).toBeVisible();
  });

  test('keeps the order summary in view while the lines scroll on desktop', async ({ page, context, request }) => {
    // A long cart: every other product of the mock catalogue joins the seeded customer's 2 lines.
    const auth = { Authorization: 'Bearer test-customer' };
    const cart = (await (await request.get(`${MOCK_API}/api/customer/v3/cart`, { headers: auth })).json()) as { data: { items: { product: { id: number } }[] } };
    const inCart = new Set(cart.data.items.map((item) => item.product.id));
    const home = (await (await request.get(`${MOCK_API}/api/customer/v3/home`)).json()) as { data: { sections: { products: { id: number }[] }[] } };
    const extra = [...new Set(home.data.sections.flatMap((section) => section.products.map((product) => product.id)))].filter((id) => !inCart.has(id));
    expect(extra.length).toBeGreaterThanOrEqual(6);
    for (const id of extra) {
      expect((await request.put(`${MOCK_API}/api/customer/v3/cart/items/${id}`, { headers: auth, data: { quantity: 1 } })).ok()).toBe(true);
    }

    await signIn(context);
    await openCart(page, 'en');
    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(inCart.size + extra.length);
    const summary = page.getByTestId('cart-summary');

    // The first line and the summary start at the same height; scroll well into the list.
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(lines.first()).not.toBeInViewport();
    await expect(summary).toBeInViewport({ ratio: 1 });
    await expect(summary.getByRole('link', { name: 'Checkout' })).toBeInViewport();

    // It sits below the sticky header, not under it.
    const header = await page.getByRole('banner').boundingBox();
    const box = await summary.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
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
    await expect(page.getByRole('heading', { level: 1, name: 'سلة التسوق (٣)' })).toBeVisible();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    await expect(page.getByTestId('cart-total')).toHaveText('١٩٦ ج.م');
    await expect(page.getByTestId('checkout-blockers')).toContainText('أضف 104 ج.م للوصول للحد الأدنى للطلب.');
    await expect(page.getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByTestId('cart-line').nth(1).getByRole('button', { name: 'زيادة الكمية' }).click();
    await expect(page.getByTestId('cart-total')).toHaveText('٣٥٦ ج.م');
    await expect(page.getByTestId('cart-title')).toHaveText('سلة التسوق (٤)');
    await expect(page.getByRole('link', { name: 'إتمام الطلب' })).toHaveAttribute('href', '/ar/checkout');
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
