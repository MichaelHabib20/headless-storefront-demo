import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Insurance (the /account/insurance page, and the insurance prescription kind) against the mock API
 * (scripts/mock/insurance.mjs + prescriptions.mjs). "test-customer" has one profile (Misr Insurance —
 * Mona Ali). The mock store asks the national ID as a number and the card as photos. Staging has
 * insurance off.
 */
test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API (staging has insurance off)');

async function signIn(context: BrowserContext) {
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

async function insurance(request: APIRequestContext, on: boolean) {
  await request.post(`${MOCK_API}/__mode`, { data: { insurance: { on } } });
}

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

const pixel = { name: 'card.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') };

test.beforeEach(async ({ request, page }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

test('off (as on staging): no page, no account link, no insurance kind', async ({ page, context }) => {
  await signIn(context);
  expect((await open(page, '/en/account/insurance'))?.status()).toBe(404);
  await open(page, '/en/account');
  await expect(page.getByRole('link', { name: 'Insurance' })).toHaveCount(0);
});

test('the page: the profile on record, adding one with card photos, deleting', async ({ page, context, request }) => {
  await insurance(request, true);
  await signIn(context);
  await open(page, '/en/account');
  await page.getByRole('link', { name: 'Insurance' }).click();
  await expect(page).toHaveURL(/\/en\/account\/insurance$/);
  await expect(page.getByTestId('insurance-profile')).toHaveCount(1);
  await expect(page.getByTestId('insurance-profile')).toContainText('•••• 4567');

  const form = page.getByTestId('insurance-form');
  await form.getByLabel(/Insurance company/).selectOption('2');
  await form.getByLabel(/National ID number/).fill('29001019999999');
  await form.getByTestId('file-insuranceCardFiles').setInputFiles([pixel, { ...pixel, name: 'back.png' }]);
  await expect(form.getByTestId('files-insuranceCardFiles').locator('li')).toHaveCount(2);
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('insurance-notice')).toHaveText('Your insurance details were saved.');
  await expect(page.getByTestId('insurance-profile')).toHaveCount(2);

  await page.getByTestId('insurance-delete').first().click();
  await expect(page.getByTestId('insurance-notice')).toHaveText('Your insurance details were deleted.');
  await expect(page.getByTestId('insurance-profile')).toHaveCount(1);
});

test('an insurance prescription: its fields appear only for the insurance kind', async ({ page, context, request }) => {
  await insurance(request, true);
  await signIn(context);
  await open(page, '/en/prescriptions');
  const form = page.getByTestId('prescription-form');
  await expect(form.getByLabel(/Insurance details/)).toHaveCount(0);

  await form.getByLabel('Prescription type').selectOption('insurance');
  await expect(form.getByLabel(/Insurance details/)).toHaveValue('7');
  await form.getByLabel('Approval').selectOption('yes');
  await form.getByLabel(/Approval number/).fill('AP-2026');
  await form.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByTestId('prescription-sent')).toBeVisible();
});
