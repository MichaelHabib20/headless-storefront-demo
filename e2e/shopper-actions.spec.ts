import { expect, test, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/*
 * Card actions (add to cart, wishlist, compare) and header counts against the stateful mock API.
 * Home products in order: 36480, 7346, 8412, 8658, 33594, 9822, ...
 * The seeded customer ("test-customer") has 36480 ×2 and 7346 in the cart, 8412/8658/33594 in the
 * wishlist, 36480/8412 in compare (max 4) and 24 unread notifications.
 */
const MOCK = MOCK_API;

test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API');

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

const card = (page: Page, index: number) => page.getByTestId('product-card').nth(index);
const header = (page: Page) => page.getByRole('banner');

async function signInAsTestCustomer(page: Page) {
  await page.context().addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true }]);
}

test.describe('shopper actions', () => {
  test('a guest adds to cart from the home page and the header count follows', async ({ page }) => {
    await page.goto('/en');
    await expect(header(page).getByRole('link', { name: 'Cart', exact: true })).toHaveAttribute('href', '/en/cart');
    // Rendering pages never starts a guest session.
    expect((await page.context().cookies()).find((c) => c.name === 'sc_guest')).toBeUndefined();

    const first = card(page, 0);
    await first.getByRole('button', { name: 'Add to cart' }).click();

    await expect(first.getByRole('status')).toHaveText('Added to cart.');
    await expect(header(page).getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
    await expect(first.getByRole('link', { name: 'In cart (1)' })).toHaveAttribute('href', '/en/cart');

    const guest = (await page.context().cookies()).find((c) => c.name === 'sc_guest');
    expect(guest?.httpOnly).toBe(true);

    await page.reload();
    await expect(header(page).getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
    await expect(card(page, 0).getByRole('link', { name: 'In cart (1)' })).toBeVisible();
  });

  test('a guest toggles wishlist and compare', async ({ page }) => {
    await page.goto('/en');
    const first = card(page, 0);
    const heart = first.getByRole('button', { name: 'Save to wishlist' });
    const compare = first.getByRole('button', { name: 'Compare', exact: true });
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect(compare).toHaveAttribute('aria-pressed', 'false');

    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true');
    await expect(first.getByRole('status')).toHaveText('Saved to your wishlist.');
    await expect(header(page).getByRole('link', { name: 'Wishlist, 1 item' })).toBeVisible();

    await compare.click();
    await expect(compare).toHaveAttribute('aria-pressed', 'true');
    await expect(first.getByRole('status')).toHaveText('Added to compare.');
    await expect(header(page).getByRole('link', { name: 'Compare, 1 product' })).toHaveAttribute('href', '/en/compare');

    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'false');
    await expect(first.getByRole('status')).toHaveText('Removed from your wishlist.');
    await expect(header(page).getByRole('link', { name: 'Wishlist', exact: true })).toBeVisible();

    await page.reload();
    await expect(card(page, 0).getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 0).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'false');
  });

  // Regression (found on live staging): quick clicks before the first write finishes used to start
  // two guest sessions, and the second session's cookie orphaned the first write.
  test('quick clicks on a slow backend all land in one guest session', async ({ page, request, context }) => {
    await request.post(`${MOCK}/__mode`, { data: { delayMs: 600 } });
    await page.goto('/en');
    await page.waitForLoadState('networkidle');

    const first = card(page, 0);
    const second = card(page, 1);
    await first.getByRole('button', { name: 'Save to wishlist' }).click();
    await first.getByRole('button', { name: 'Compare', exact: true }).click();
    await second.getByRole('button', { name: 'Save to wishlist' }).click();

    await expect(header(page).getByRole('link', { name: 'Wishlist, 2 items' })).toBeVisible({ timeout: 15_000 });
    await expect(header(page).getByRole('link', { name: 'Compare, 1 product' })).toBeVisible();
    expect((await context.cookies()).filter((c) => c.name === 'sc_guest')).toHaveLength(1);

    await request.post(`${MOCK}/__mode`, { data: { delayMs: 0 } });
    await page.reload();
    await expect(card(page, 0).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 0).getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 1).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('the signed-in customer sees their counts and state on the cards', async ({ page }) => {
    await signInAsTestCustomer(page);
    await page.goto('/en');

    await expect(header(page).getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Wishlist, 3 items' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Compare, 2 products' })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Notifications, 24 unread' })).toHaveAttribute('href', '/en/notifications');

    await expect(card(page, 0).getByRole('link', { name: 'In cart (2)' })).toBeVisible();
    await expect(card(page, 0).getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 2).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('says so when the compare list is full', async ({ page }) => {
    await signInAsTestCustomer(page);
    await page.goto('/en');
    await expect(header(page).getByRole('link', { name: 'Compare, 2 products' })).toBeVisible();

    // Cards 0 and 2 are already compared; cards 3 and 4 fill the list up to the backend maximum (4).
    for (const index of [3, 4]) {
      const button = card(page, index).getByRole('button', { name: 'Compare', exact: true });
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page, index).getByRole('status')).toHaveText('Added to compare.');
    }
    await expect(header(page).getByRole('link', { name: 'Compare, 4 products' })).toBeVisible();

    const fifth = card(page, 5);
    const button = fifth.getByRole('button', { name: 'Compare', exact: true });
    await button.click();
    await expect(fifth.getByRole('status')).toHaveText('You can compare up to 4 products.');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(header(page).getByRole('link', { name: 'Compare, 4 products' })).toBeVisible();
  });

  test('works in Arabic', async ({ page }) => {
    await page.goto('/ar');
    const first = card(page, 0);
    await first.getByRole('button', { name: 'أضف إلى السلة' }).click();
    await expect(first.getByRole('status')).toHaveText('تمت الإضافة إلى السلة.');
    await expect(header(page).getByRole('link', { name: 'السلة، منتج واحد' })).toHaveAttribute('href', '/ar/cart');
  });
});
