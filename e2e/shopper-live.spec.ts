import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { formatMoney } from '../src/lib/format';
import { acceptCookies, customerToken, live, signInAsCustomer } from './support';

/**
 * Cart, wishlist, compare and notifications against REAL seif-staging (E2E_LIVE=1), as a guest and
 * as the staging test customer. What the page shows is compared with what the API returned for
 * the same shopper, so the storefront provably displays backend values. The customer's cart is
 * restored at the end of each test that changes it.
 */
test.skip(!live, 'live staging only (E2E_LIVE=1)');
test.describe.configure({ mode: 'serial' });

const API = (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '') + '/api/customer/v3';

async function api<T>(path: string, token: string | null, locale = 'en', init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'Accept-Language': locale, 'device-type': 'web' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API}/${path}`, { ...init, headers });
  const body = (await res.json()) as { data: T };
  return body.data;
}

type Cart = { items: { product: { id: number }; quantity: number }[]; summary: { total: { amount: number; currency: string | null }; subtotal: { amount: number; currency: string | null } }; checkout: { allowed: boolean } };
type Me = { counts: { cart: number; wishlist: number; compare: number; unreadNotifications: number } };

async function guestCookie(context: BrowserContext): Promise<string | null> {
  return (await context.cookies()).find((c) => c.name === 'sc_guest')?.value ?? null;
}

async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

test.describe('live: guest shopper', () => {
  test('adds to cart from home, the cart shows the API totals, then empties it', async ({ page, context }) => {
    await acceptCookies(page);
    await open(page, '/en');
    expect(await guestCookie(context)).toBeNull(); // viewing never creates a guest

    const card = page.getByTestId('product-card').filter({ has: page.getByRole('button', { name: 'Add to cart', disabled: false }) }).first();
    await card.getByRole('button', { name: 'Add to cart' }).click();
    await expect.poll(() => guestCookie(context)).not.toBeNull(); // the first write starts the guest session
    const guest = (await guestCookie(context))!;

    const cart = await api<Cart>('cart', guest);
    expect(cart.items.length).toBe(1);
    await open(page, '/en/cart');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-total')).toHaveText(formatMoney(cart.summary.total.amount, cart.summary.total.currency, 'en'));
    await expect(page.getByRole('banner')).toContainText('1');

    // Quantity +1: the new total on the page is the API's new total.
    await page.getByTestId('cart-line').first().getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.getByTestId('cart-quantity').first()).toHaveText('2');
    const after = await api<Cart>('cart', guest);
    await expect(page.getByTestId('cart-total')).toHaveText(formatMoney(after.summary.total.amount, after.summary.total.currency, 'en'));

    await page.getByTestId('cart-line').first().getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByTestId('cart-empty')).toBeVisible();
    expect((await api<Cart>('cart', guest)).items).toHaveLength(0);
  });

  test('saves to the wishlist and compares, then removes them', async ({ page, context }) => {
    await acceptCookies(page);
    await open(page, '/en');
    const card = page.getByTestId('product-card').first();
    await card.getByRole('button', { name: 'Save to wishlist' }).click();
    await expect(card.getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // The buttons flip immediately (optimistic); the header counts change only once the backend confirmed both.
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Wishlist, 1 item' })).toBeVisible({ timeout: 20_000 });
    await expect(header.getByRole('link', { name: 'Compare, 1 product' })).toBeVisible({ timeout: 20_000 });
    const guest = (await guestCookie(context))!;
    expect((await api<Me>('me', guest)).counts).toMatchObject({ wishlist: 1, compare: 1 });

    await open(page, '/en/wishlist');
    await expect(page.getByTestId('wishlist-item')).toHaveCount(1);
    await page.getByTestId('wishlist-item').first().getByRole('button', { name: /^Remove/ }).click();
    await expect(page.getByTestId('wishlist-empty')).toBeVisible();

    await open(page, '/en/compare');
    await expect(page.getByTestId('compare-product')).toHaveCount(1);
    await page.getByTestId('compare-product').first().getByRole('button', { name: /^Remove/ }).click();
    await expect(page.getByTestId('compare-empty')).toBeVisible();
    expect((await api<Me>('me', guest)).counts).toMatchObject({ wishlist: 0, compare: 0 });
  });
});

test.describe('live: signed-in customer', () => {
  test.beforeEach(async ({ page, context }) => {
    await acceptCookies(page);
    await signInAsCustomer(context);
  });

  test('cart page matches the API in English and Arabic', async ({ page }) => {
    const token = await customerToken();
    for (const locale of ['en', 'ar'] as const) {
      const cart = await api<Cart>('cart', token, locale);
      await open(page, `/${locale}/cart`);
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
      await expect(page.getByTestId('cart-line')).toHaveCount(cart.items.length);
      if (cart.items.length) {
        await expect(page.getByTestId('cart-subtotal')).toHaveText(formatMoney(cart.summary.subtotal.amount, cart.summary.subtotal.currency, locale));
        await expect(page.getByTestId('cart-total')).toHaveText(formatMoney(cart.summary.total.amount, cart.summary.total.currency, locale));
      }
      const checkoutName = locale === 'ar' ? 'إتمام الطلب' : 'Checkout';
      if (cart.checkout.allowed) await expect(page.getByRole('link', { name: checkoutName })).toBeVisible();
      else await expect(page.getByRole('button', { name: checkoutName })).toBeDisabled();
    }
  });

  test('changing a quantity updates the total from the API, and is restored', async ({ page }) => {
    const token = await customerToken();
    const before = await api<Cart>('cart', token);
    test.skip(before.items.length === 0, 'the staging test customer has an empty cart');
    const line = before.items[0];

    await open(page, '/en/cart');
    try {
      const beforeText = formatMoney(before.summary.total.amount, before.summary.total.currency, 'en');
      await page.getByTestId('cart-line').first().getByRole('button', { name: 'Increase quantity' }).click();
      await expect(page.getByTestId('cart-quantity').first()).toHaveText(String(line.quantity + 1));
      // The quantity changes at once; the total changes only when the backend answered with the new cart.
      await expect(page.getByTestId('cart-total')).not.toHaveText(beforeText, { timeout: 20_000 });
      const after = await api<Cart>('cart', token);
      expect(after.summary.total.amount).toBeGreaterThan(before.summary.total.amount);
      await expect(page.getByTestId('cart-total')).toHaveText(formatMoney(after.summary.total.amount, after.summary.total.currency, 'en'));
    } finally {
      await api<Cart>(`cart/items/${line.product.id}`, token, 'en', { method: 'PUT', body: JSON.stringify({ quantity: line.quantity }) });
    }
    expect((await api<Cart>('cart', token)).summary.total.amount).toBe(before.summary.total.amount);
  });

  test('header counts, wishlist, compare and notifications match the API', async ({ page }) => {
    const token = await customerToken();
    const me = await api<Me>('me', token);
    await open(page, '/en');
    const header = page.getByRole('banner');
    if (me.counts.cart) await expect(header).toContainText(String(me.counts.cart));

    await open(page, '/en/wishlist');
    const wishlist = await api<{ pagination: { total: number } }>('wishlist?perPage=12', token);
    if (wishlist.pagination.total) await expect(page.getByTestId('wishlist-item')).toHaveCount(Math.min(12, wishlist.pagination.total));
    else await expect(page.getByTestId('wishlist-empty')).toBeVisible();

    await open(page, '/en/compare');
    const compare = await api<{ products: unknown[]; attributes: unknown[] }>('compare', token);
    if (compare.products.length) {
      await expect(page.getByTestId('compare-product')).toHaveCount(compare.products.length);
      await expect(page.getByTestId('compare-row')).toHaveCount(compare.attributes.length);
    } else await expect(page.getByTestId('compare-empty')).toBeVisible();

    await open(page, '/en/notifications');
    const notifications = await api<{ pagination: { total: number } }>('notifications?perPage=10', token);
    if (notifications.pagination.total) await expect(page.getByTestId('notification')).toHaveCount(Math.min(10, notifications.pagination.total));
    else await expect(page.getByTestId('notifications-empty')).toBeVisible();
    // Reading the page never marks anything as read.
    expect((await api<Me>('me', token)).counts.unreadNotifications).toBe(me.counts.unreadNotifications);

    await open(page, '/ar/wishlist');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
