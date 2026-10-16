import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Notifications against the mock API (scripts/mock/shopper.mjs): "test-customer" has 25
 * notifications, #903 already read → 24 unread. State is reset before every test.
 */
const live = process.env.E2E_LIVE === '1';

test.skip(live, 'needs the mock API state (seeded customer + /__reset)');

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

/** Unread count straight from the API, independent of what the page shows. */
async function unreadOnServer(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${MOCK_API}/api/customer/v3/me`, { headers: { Authorization: 'Bearer test-customer' } });
  return (await response.json()).data.counts.unreadNotifications;
}

const notification = (page: Page, title: string) => page.getByTestId('notification').filter({ hasText: title });

test.beforeEach(async ({ request, page }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

test.describe('notifications (signed in)', () => {
  test.beforeEach(async ({ context }) => signIn(context));

  test('lists notifications and shows which are unread', async ({ page }) => {
    await page.goto('/en/notifications');

    await expect(page.getByRole('heading', { level: 1, name: 'Notifications' })).toBeVisible();
    await expect(page.getByTestId('notifications-unread')).toHaveText('24 unread');
    await expect(page.getByTestId('notification')).toHaveCount(10);
    await expect(page.locator('[data-testid="notification"][data-read="false"]')).toHaveCount(9);
    await expect(notification(page, 'Upload your prescription')).toHaveAttribute('data-read', 'true');
    await expect(notification(page, 'Baby care week').getByRole('link')).toHaveAttribute('href', '/en/products/list/125');
  });

  test('marking one as read lowers the unread count', async ({ page, request }) => {
    await page.goto('/en/notifications');
    const item = notification(page, 'Your order is on its way');
    await item.getByRole('button', { name: 'Mark as read' }).click();

    await expect(page.getByTestId('notifications-unread')).toHaveText('23 unread');
    await expect(item).toHaveAttribute('data-read', 'true');
    await expect(item.getByRole('button')).toHaveCount(0);
    expect(await unreadOnServer(request)).toBe(23);
  });

  test('marks everything as read', async ({ page, request }) => {
    await page.goto('/en/notifications');
    await page.getByRole('button', { name: 'Mark all as read' }).click();

    await expect(page.getByTestId('notifications-unread')).toHaveText("You're all caught up");
    await expect(page.getByRole('button', { name: 'Mark as read' })).toHaveCount(0);
    await expect(page.locator('[data-testid="notification"][data-read="false"]')).toHaveCount(0);
    expect(await unreadOnServer(request)).toBe(0);
  });

  test('reading the page never marks anything as read', async ({ page, request }) => {
    await page.goto('/en/notifications');
    await expect(page.getByTestId('notifications-unread')).toHaveText('24 unread');

    await page.getByRole('navigation', { name: 'Notification pages' }).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/en\/notifications\?page=2$/);
    await page.reload();
    await page.goto('/en/notifications');

    await expect(page.getByTestId('notifications-unread')).toHaveText('24 unread');
    await expect(page.locator('[data-testid="notification"][data-read="false"]')).toHaveCount(9);
    expect(await unreadOnServer(request)).toBe(24);
  });

  test('opening a notification marks it as read', async ({ page, request }) => {
    await page.goto('/en/notifications');
    await notification(page, 'Baby care week').getByRole('link').click();
    await expect(page).toHaveURL(/\/en\/products\/list\/125$/);

    await expect.poll(() => unreadOnServer(request)).toBe(23);
    await page.goto('/en/notifications');
    await expect(notification(page, 'Baby care week')).toHaveAttribute('data-read', 'true');
  });

  test('pages through older notifications', async ({ page }) => {
    await page.goto('/en/notifications');
    const pagination = page.getByRole('navigation', { name: 'Notification pages' });
    await expect(pagination).toContainText('Page 1 of 3');

    await pagination.getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?page=2$/);
    await expect(pagination).toContainText('Page 2 of 3');
    await expect(notification(page, 'Offer of the day #8')).toBeVisible();

    await pagination.getByRole('link', { name: 'Previous' }).click();
    await expect(page).toHaveURL(/\/en\/notifications$/);
    await expect(notification(page, 'Your order is on its way')).toBeVisible();
  });

  test('works in Arabic', async ({ page, request }) => {
    await page.goto('/ar/notifications');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'الإشعارات' })).toBeVisible();
    await expect(page.getByTestId('notifications-unread')).toHaveText('24 غير مقروءة');
    await expect(notification(page, 'أسبوع العناية بالطفل').getByRole('link')).toHaveAttribute('href', '/ar/products/list/125');

    await page.getByRole('button', { name: 'تحديد الكل كمقروء' }).click();
    await expect(page.getByTestId('notifications-unread')).toHaveText('اطّلعت على كل الإشعارات');
    expect(await unreadOnServer(request)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('notifications (no session)', () => {
  test('shows a friendly empty state and never starts a guest session', async ({ page, context }) => {
    await page.goto('/en/notifications');

    await expect(page.getByTestId('notifications-empty')).toContainText('Nothing here yet');
    await expect(page.getByTestId('notification')).toHaveCount(0);
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_guest')).toBe(false);
  });
});
