import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, resetMock, signInAsCustomer } from './support';

/**
 * Orders extras against the stateful mock: tracking an order without sign-in, rating a delivered
 * order, writing a product review (from the order and from the product page) and sharing a product.
 * Every rule (who may rate / review, which fields the dialog has) is the mock backend's answer.
 */
test.skip(live, 'needs the stateful mock API');

const AUTH = { Authorization: 'Bearer test-customer' };

/** Product pages of the mock (scripts/mock/product.mjs): 9822 takes reviews, 33594 has reviews off. */
type Locale = 'en' | 'ar';
const catalog = (locale: Locale) =>
  (JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data.sections as { products: { id: number; slug: string }[] }[]).flatMap(
    (s) => s.products,
  );
const productPath = (id: number, locale: Locale = 'en') => `/${locale}/${encodeURIComponent(catalog(locale).find((p) => p.id === id)!.slug)}`;

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test.describe('track an order without signing in', () => {
  test('finds the order by number + phone and shows it read-only', async ({ page, context }) => {
    await open(page, '/en/account/track-your-order');
    await expect(page.getByRole('heading', { level: 1, name: 'Track your order' })).toBeVisible();
    await page.getByLabel('Order number').fill('48200');
    await page.getByLabel('Phone number').fill('01000000001');
    await page.getByRole('button', { name: 'Find my order' }).click();

    await expect(page).toHaveURL(/\/en\/account\/track-your-order\?number=48200&phone=01000000001/);
    await expect(page.getByTestId('order')).toHaveAttribute('data-order-id', 'mock-order-48200');
    await expect(page.getByTestId('order-actions')).toHaveCount(0);
    await expect(page.getByTestId('order-rating')).toHaveCount(0);
    // reading never starts a guest session
    expect((await context.cookies()).find((c) => c.name === 'sc_guest')).toBeUndefined();
  });

  test('says so when the pair does not match (Arabic)', async ({ page }) => {
    await open(page, '/ar/account/track-your-order?number=48200&phone=01099999999');
    await expect(page.getByTestId('track-order-not-found')).toHaveText('لم نجد طلباً بهذا الرقم ورقم الهاتف.');
    await expect(page.getByTestId('order')).toHaveCount(0);
    await expect(page.getByLabel('رقم الطلب')).toHaveValue('48200');
  });
});

test.describe('rate an order', () => {
  test.beforeEach(async ({ context }) => signInAsCustomer(context));

  test('rates the delivered order with the fields the API describes; the rating then shows', async ({ page, request }) => {
    await open(page, '/en/account/order-history/mock-order-48200');
    await page.getByRole('button', { name: 'Rate this order' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rate your order' });
    await expect(dialog.getByRole('button', { name: 'Send my rating' })).toBeDisabled();
    await dialog.getByTestId('stars-rating').getByLabel('4 stars').check();
    await dialog.getByTestId('stars-driverRating').getByLabel('5 stars').check();
    await dialog.getByLabel('Tell us more (optional)').fill('Fast and friendly');
    await dialog.getByRole('button', { name: 'Send my rating' }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('order-rating-status')).toHaveText('Thank you for rating your order.');
    await expect(page.getByTestId('order-rating').getByRole('img', { name: 'Rated 4 out of 5' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rate this order' })).toHaveCount(0);

    const stored = await (await request.get(`${MOCK_API}/api/customer/v3/orders/mock-order-48200`, { headers: AUTH })).json();
    expect(stored.data.rating).toEqual({ rating: 4, driverRating: 5, feedback: 'Fast and friendly' });
    expect(stored.data.actions.canRate).toBe(false);
  });

  test('shows the existing rating of a rated order and offers nothing on an order in progress', async ({ page }) => {
    await open(page, '/ar/account/order-history/mock-order-48199');
    await expect(page.getByTestId('order-rating')).toContainText('سريع وودود');
    await expect(page.getByRole('button', { name: 'قيّم هذا الطلب' })).toHaveCount(0);

    await open(page, '/en/account/order-history/mock-order-48201');
    await expect(page.getByTestId('order-rating')).toHaveCount(0);
  });

  test('opening the order page never rates it (GET never writes)', async ({ page, request }) => {
    await open(page, '/en/account/order-history/mock-order-48200');
    await page.reload();
    const stored = await (await request.get(`${MOCK_API}/api/customer/v3/orders/mock-order-48200`, { headers: AUTH })).json();
    expect(stored.data.rating).toBeNull();
    expect(stored.data.actions.canRate).toBe(true);
  });
});

test.describe('write a review', () => {
  test('from a delivered order', async ({ page, context }) => {
    await signInAsCustomer(context);
    await open(page, '/en/account/order-history/mock-order-48200');
    await page.getByTestId('item-review').first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('5 stars').check();
    await dialog.getByLabel('Your review').fill('Great product');
    await dialog.getByRole('button', { name: 'Send review' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('item-review-done')).toHaveText('Thank you! Your review will show once it is approved.');
  });

  test('from the product page when signed in; a sign-in link otherwise', async ({ page, context }) => {
    await open(page, productPath(9822));
    const note = page.getByTestId('write-review-sign-in');
    await expect(note).toContainText('Sign in to write a review.');
    await expect(note.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', /\/en\/session\/signin\?returnUrl=/);
    expect((await context.cookies()).find((c) => c.name === 'sc_guest')).toBeUndefined();

    await signInAsCustomer(context);
    await open(page, productPath(9822, 'ar'));
    await page.getByTestId('write-review').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('٣ نجوم').check();
    await dialog.getByLabel('رأيك').fill('منتج جيد');
    await dialog.getByRole('button', { name: 'إرسال التقييم' }).click();
    await expect(page.getByTestId('write-review-done')).toHaveText('شكراً لك! سيظهر تقييمك بعد الموافقة عليه.');
  });

  test('offers nothing where the store has reviews off', async ({ page, context }) => {
    await signInAsCustomer(context);
    await open(page, productPath(33594));
    await expect(page.getByTestId('write-review')).toHaveCount(0);
    await expect(page.getByTestId('product-reviews')).toHaveCount(0);
  });
});

test.describe('share a product', () => {
  test('shows the share menu with the page link (desktop and 360 px)', async ({ page }) => {
    await open(page, productPath(9822));
    await page.getByRole('button', { name: 'Share' }).click();
    const menu = page.getByRole('menu', { name: 'Share this product' });
    await expect(menu.getByRole('menuitem', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/\?text=.*jj-baby-cologne-100ml-dream/);
    await expect(menu.getByRole('menuitem', { name: 'Copy link' })).toBeVisible();

    await page.setViewportSize({ width: 360, height: 740 });
    await expect(page.getByRole('button', { name: 'Share' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
