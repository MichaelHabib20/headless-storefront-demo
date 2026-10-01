import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, resetMock, signInAsCustomer } from './support';

/**
 * Loyalty, El Dokan and iVend (the old /account/your-points, vouchers, vouchers/:id(/:name), history,
 * get-free-points) against the mock API (scripts/mock/loyalty.mjs): points, rewards and their reasons,
 * the phone blocker, redeeming, history, referral, iVend's summary-only pages, and the off state
 * (staging has no loyalty). Every text asserted is the mock backend's or our i18n.
 */
test.skip(live, 'needs the stateful mock API (staging has loyalty off)');

const AUTH = { Authorization: 'Bearer test-customer' };

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

async function mode(request: APIRequestContext, loyalty: Record<string, unknown>) {
  await request.post(`${MOCK_API}/__mode`, { data: { loyalty } });
}

async function pointsOnServer(request: APIRequestContext) {
  const response = await request.get(`${MOCK_API}/api/customer/v3/loyalty`, { headers: AUTH });
  return (await response.json()).data.points.text as string;
}

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test('off (as on staging): no pages, no account link', async ({ page, context }) => {
  await signInAsCustomer(context);
  for (const path of ['/en/account/your-points', '/en/account/vouchers', '/en/account/vouchers/3', '/en/account/history', '/en/account/get-free-points']) {
    expect((await open(page, path))?.status(), path).toBe(404);
  }
  await open(page, '/en/account');
  await expect(page.getByTestId('account-links')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Points and rewards' })).toHaveCount(0);
});

test('a visitor is asked to sign in, and no guest session is created', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan' });
  await open(page, '/en/account/your-points');
  await expect(page.getByTestId('account-sign-in').getByRole('link')).toHaveAttribute('href', /\/en\/sign-in\?next=%2Fen%2Faccount%2Fyour-points/);
  expect((await context.cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
  const response = await page.request.get('/en/account/your-points', { maxRedirects: 0 });
  expect(response.headers()['x-robots-tag']).toContain('noindex');
});

test('El Dokan: points, rewards with reasons, redeem a voucher', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan' });
  await signInAsCustomer(context);
  await open(page, '/en/account');
  await page.getByRole('link', { name: 'Points and rewards' }).click();
  await expect(page).toHaveURL(/\/en\/account\/your-points$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Your points' })).toBeVisible();
  await expect(page.getByTestId('loyalty-points')).toHaveText('1,000 points');
  await expect(page.getByTestId('loyalty-tier')).toContainText('Spend 300 EGP more to become a Gold member.');

  await page.getByTestId('loyalty-nav').getByRole('link', { name: 'Rewards' }).click();
  const rewards = page.getByTestId('reward');
  await expect(rewards).toHaveCount(4);
  await expect(rewards.nth(2).getByTestId('reward-reason')).toHaveText('For Gold members only.');
  await expect(rewards.nth(3).getByTestId('reward-reason')).toHaveText('You need 1,000 points more.');

  // a reward that cannot be redeemed has no button
  await open(page, '/en/account/vouchers/6');
  await expect(page.getByRole('button', { name: 'Redeem' })).toHaveCount(0);

  await open(page, '/en/account/vouchers');
  await page.getByRole('link', { name: 'View reward: 50 EGP off' }).click();
  await expect(page).toHaveURL(/\/en\/account\/vouchers\/3$/);
  await page.getByRole('button', { name: 'Redeem' }).click();
  await expect(page.getByTestId('redemption-code')).toHaveText('GIFT-MOCK1');
  await expect(page.getByTestId('redemption-points')).toHaveText('Points left: 500 points');
  expect(await pointsOnServer(request)).toBe('500 points');
});

test('an unverified phone blocks redeeming and links the verify-phone page', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan', phone: 'unverified' });
  await signInAsCustomer(context);
  await open(page, '/ar/account/vouchers');
  const blocker = page.getByTestId('loyalty-blocker');
  await expect(blocker).toContainText('وثّق رقم هاتفك لاستبدال المكافآت.');
  await expect(blocker.getByRole('link', { name: 'توثيق رقم هاتفي' })).toHaveAttribute('href', '/ar/verify-phone');
  await open(page, '/ar/account/vouchers/3');
  await expect(page.getByRole('button', { name: 'استبدال' })).toHaveCount(0);
  expect(await pointsOnServer(request)).toBe('1,000 points');
});

test('old reward links with a name still open the reward', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan' });
  await signInAsCustomer(context);
  expect((await open(page, '/en/account/vouchers/4/10-off'))?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: '10% off' })).toBeVisible();
  expect((await open(page, '/en/account/vouchers/99'))?.status()).toBe(404);
  expect((await open(page, '/en/account/vouchers/abc'))?.status()).toBe(404);
});

test('history newest first, with the order linked (AR)', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan' });
  await signInAsCustomer(context);
  await open(page, '/ar/account/history');
  await expect(page.getByRole('heading', { level: 1, name: 'سجل النقاط' })).toBeVisible();
  const entries = page.getByTestId('history-entry');
  await expect(entries).toHaveCount(5);
  await expect(entries.first()).toHaveAttribute('data-kind', 'pending');
  await expect(entries.nth(1)).toContainText('-500 نقطة');
  await expect(entries.nth(3).getByRole('link', { name: 'عرض الطلب' })).toHaveAttribute('href', '/ar/account/orders/mock-order-48200');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('referral code when the store has referral on; 404 when off', async ({ page, context, request }) => {
  await mode(request, { provider: 'elDokan' });
  await signInAsCustomer(context);
  await open(page, '/en/account/get-free-points');
  await expect(page.getByRole('heading', { level: 1, name: 'Get free points' })).toBeVisible();
  await expect(page.getByTestId('referral-code')).toHaveText('MONA50');
  await expect(page.getByRole('button', { name: 'Copy invite text' })).toBeVisible();

  await mode(request, { referral: false });
  expect((await open(page, '/en/account/get-free-points'))?.status()).toBe(404);
  await open(page, '/en/account/your-points');
  await expect(page.getByTestId('loyalty-nav').getByRole('link', { name: 'Get free points' })).toHaveCount(0);
});

test('iVend: points, their value and store credit only', async ({ page, context, request }) => {
  await mode(request, { provider: 'ivend' });
  await signInAsCustomer(context);
  await open(page, '/en/account/your-points');
  await expect(page.getByTestId('loyalty-summary')).toHaveAttribute('data-provider', 'ivend');
  await expect(page.getByTestId('loyalty-points')).toHaveText('1,500 points');
  await expect(page.getByTestId('loyalty-value')).toHaveText('100 EGP');
  await expect(page.getByTestId('loyalty-credit')).toHaveText('25.5 EGP');
  await expect(page.getByTestId('loyalty-nav')).toHaveCount(0);
  for (const path of ['/en/account/vouchers', '/en/account/history', '/en/account/get-free-points']) {
    expect((await open(page, path))?.status(), path).toBe(404);
  }
});
