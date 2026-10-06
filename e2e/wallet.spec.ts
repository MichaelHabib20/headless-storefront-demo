import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * The wallet (the old /account/wallet-history, and paying with it at checkout) against the mock API
 * (scripts/mock/wallet.mjs + checkout.mjs). "test-customer" has 150 EGP. `fillCart()` makes the order
 * 356 EGP + 25 EGP delivery = 381 EGP. Every money text is the mock backend's. Staging has the wallet off.
 */
test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API (staging has the wallet off)');

const API = `${MOCK_API}/api/customer/v3`;
const CUSTOMER = { Authorization: 'Bearer test-customer' };

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

async function wallet(request: APIRequestContext, data: Record<string, unknown>) {
  await request.post(`${MOCK_API}/__mode`, { data: { wallet: data } });
}

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

const total = (page: Page) => page.getByTestId('checkout-total');

test.beforeEach(async ({ request, page }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

test('off (as on staging): no page, no account link, no checkout switch', async ({ page, context }) => {
  await signIn(context);
  expect((await open(page, '/en/account/wallet-history'))?.status()).toBe(404);
  await open(page, '/en/account');
  await expect(page.getByTestId('account-links')).toBeVisible();
  await expect(page.getByRole('link', { name: 'My wallet' })).toHaveCount(0);
  await open(page, '/en/checkout');
  await expect(page.getByTestId('checkout')).toBeVisible();
  await expect(page.getByTestId('checkout-wallet')).toHaveCount(0);
});

test('a visitor is asked to sign in, and no guest session is created', async ({ page, context, request }) => {
  await wallet(request, { on: true });
  await open(page, '/en/account/wallet-history');
  await expect(page.getByTestId('account-sign-in').getByRole('link')).toHaveAttribute('href', /\/en\/sign-in\?next=%2Fen%2Faccount%2Fwallet-history/);
  expect((await context.cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
});

test('the wallet page: balance and history, in English and Arabic', async ({ page, context, request }) => {
  await wallet(request, { on: true });
  await signIn(context);
  await open(page, '/en/account');
  await page.getByRole('link', { name: 'My wallet' }).click();
  await expect(page).toHaveURL(/\/en\/account\/wallet-history$/);
  await expect(page.getByRole('heading', { level: 1, name: 'My wallet' })).toBeVisible();
  await expect(page.getByTestId('wallet-balance')).toContainText('150.00 EGP');
  const entries = page.getByTestId('wallet-entry');
  await expect(entries).toHaveCount(2);
  await expect(entries.first()).toContainText('Paid for order #48200');
  await expect(entries.first().getByTestId('wallet-entry-amount')).toHaveText('-50.00 EGP');
  await expect(entries.first().getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en/account/orders/mock-order-48200');

  await open(page, '/ar/account/wallet-history');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'محفظتي' })).toBeVisible();
  await expect(page.getByTestId('wallet-entry').first()).toContainText('دفع للطلب رقم 48200');
});

test('checkout: the wallet pays part, the rest is paid by a method', async ({ page, context, request }) => {
  await wallet(request, { on: true });
  await signIn(context);
  await request.put(`${API}/cart/items/7346`, { headers: CUSTOMER, data: { quantity: 2 } });
  await open(page, '/en/checkout');

  await page.getByRole('radio', { name: 'Cash on delivery' }).check();
  await expect(total(page)).toHaveText('381.00 EGP');
  await page.getByTestId('use-wallet').check();
  await expect(page.getByTestId('checkout-updating')).toHaveCount(0);
  await expect(page.getByTestId('wallet-message')).toHaveText('Your wallet pays 150.00 EGP. Choose how to pay the rest.');
  await expect(page.locator('[data-testid="checkout-total-line"][data-kind="wallet"]')).toContainText('-150.00 EGP');
  await expect(total(page)).toHaveText('231.00 EGP');

  await page.getByTestId('checkout-terms').check();
  await page.getByTestId('place-order').click();
  await expect(page).toHaveURL(/\/en\/checkout\/result\?checkout=/);
  await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');

  const after = await (await request.get(`${API}/wallet`, { headers: CUSTOMER })).json();
  expect(after.data.balance.amount).toBe(0);
});

test('checkout: the wallet pays everything, no payment method is asked for', async ({ page, context, request }) => {
  await wallet(request, { on: true, balance: 500 });
  await signIn(context);
  await request.put(`${API}/cart/items/7346`, { headers: CUSTOMER, data: { quantity: 2 } });
  await open(page, '/en/checkout');

  await page.getByTestId('use-wallet').check();
  await expect(page.getByTestId('checkout-updating')).toHaveCount(0);
  await expect(page.getByTestId('wallet-message')).toHaveText('Your wallet pays for the whole order.');
  await expect(page.getByTestId('checkout-payment')).toHaveCount(0);
  await expect(total(page)).toHaveText('0.00 EGP');

  await page.getByTestId('checkout-terms').check();
  await page.getByTestId('place-order').click();
  await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');

  const after = await (await request.get(`${API}/wallet`, { headers: CUSTOMER })).json();
  expect(after.data.balance.amount).toBe(119);
});
