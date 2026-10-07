import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Vouchers (the old /account/voucher, and the voucher codes at checkout) against the mock API
 * (scripts/mock/vouchers.mjs + checkout.mjs). "test-customer" has SAVE10 and FREEDEL (active), ONCE (used),
 * OLD (expired); the store also has WELCOME20. Every text asserted is the mock backend's or our i18n.
 * Staging has vouchers off.
 */
test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API (staging has vouchers off)');

const API = `${MOCK_API}/api/customer/v3`;
const CUSTOMER = { Authorization: 'Bearer test-customer' };

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

async function vouchers(request: APIRequestContext, on: boolean) {
  await request.post(`${MOCK_API}/__mode`, { data: { vouchers: { on } } });
}

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

test.beforeEach(async ({ request, page }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

test('off (as on staging): no page, no account link, no codes at checkout', async ({ page, context }) => {
  await signIn(context);
  expect((await open(page, '/en/account/voucher'))?.status()).toBe(404);
  await open(page, '/en/account');
  await expect(page.getByTestId('account-links')).toBeVisible();
  await expect(page.getByRole('link', { name: 'My vouchers' })).toHaveCount(0);
});

test('a visitor is asked to sign in', async ({ page, context, request }) => {
  await vouchers(request, true);
  await open(page, '/en/account/voucher');
  await expect(page.getByTestId('account-sign-in').getByRole('link')).toHaveAttribute('href', /\/en\/session\/signin\?returnUrl=%2Fen%2Faccount%2Fvoucher/);
  expect((await context.cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
});

test('the vouchers page: tabs, adding a code, refusals, Arabic', async ({ page, context, request }) => {
  await vouchers(request, true);
  await signIn(context);
  await open(page, '/en/account');
  await page.getByRole('link', { name: 'My vouchers' }).click();
  await expect(page).toHaveURL(/\/en\/account\/voucher$/);
  await expect(page.getByRole('heading', { level: 1, name: 'My vouchers' })).toBeVisible();
  await expect(page.getByTestId('voucher-tab')).toHaveText(['Active (2)', 'Used (1)', 'Expired (1)']);
  await expect(page.getByTestId('voucher-code')).toHaveText(['FREEDEL', 'SAVE10']);

  await page.getByRole('tab', { name: /Used/ }).click();
  await expect(page.getByTestId('voucher-code')).toHaveText(['ONCE']);

  const code = page.getByRole('textbox', { name: 'Voucher code' });
  await code.fill('NOPE');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByTestId('voucher-add-result')).toHaveText('This voucher code is not valid.');
  await expect(page.getByTestId('voucher-add-result')).toHaveAttribute('role', 'alert');

  await code.fill('welcome20');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByTestId('voucher-add-result')).toHaveText('The voucher was added to your account.');
  await expect(page.getByTestId('voucher-tab').first()).toHaveText('Active (3)');
  await expect(page.getByTestId('voucher-code')).toContainText(['WELCOME20']);

  await open(page, '/ar/account/voucher');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'قسائمي' })).toBeVisible();
});

test('checkout: a voucher code is one tap, and the backend applies it', async ({ page, context, request }) => {
  await vouchers(request, true);
  await signIn(context);
  await request.put(`${API}/cart/items/7346`, { headers: CUSTOMER, data: { quantity: 2 } });
  await open(page, '/en/checkout');

  const suggestions = page.getByTestId('promo-suggestion');
  await expect(suggestions).toHaveText(['FREEDEL Free delivery', 'SAVE10 10% off']);
  await suggestions.nth(1).click();
  await expect(page.getByTestId('checkout-updating')).toHaveCount(0);
  await expect(page.getByTestId('promo-code')).toHaveText('SAVE10');
  await expect(page.getByTestId('promo-message')).toHaveText('10% off your items.');
  await expect(suggestions).toHaveText(['FREEDEL Free delivery']);
});
