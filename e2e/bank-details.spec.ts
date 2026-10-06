import { expect, test } from '@playwright/test';
import { MOCK_API } from './support';

/** Refund bank details (/account/bank-information) against the mock API (scripts/mock/bank-details.mjs). Staging has it off. */
test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API (staging has bank details off)');

test.beforeEach(async ({ request, page, context }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
});

test('off (as on staging): no page', async ({ page }) => {
  expect((await page.goto('/en/account/bank-information'))?.status()).toBe(404);
});

test('on record masked; a refused save keeps the page; a full save replaces it', async ({ page, request }) => {
  await request.post(`${MOCK_API}/__mode`, { data: { bankDetails: { on: true } } });
  await page.goto('/en/account');
  await page.getByRole('link', { name: 'Bank details' }).click();
  await expect(page).toHaveURL(/\/en\/account\/bank-information$/);
  await expect(page.getByTestId('bank-details-saved')).toContainText('•••• 0002');

  const form = page.getByTestId('bank-details-form');
  await form.getByLabel(/Account holder full name/).fill('Mona Ali');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(form.getByTestId('field-error').first()).toHaveText('This field is required.');

  await form.getByLabel(/Account holder full name/).fill('Mona Ali');
  await form.getByLabel(/Bank name/).fill('NBE');
  await form.getByLabel(/IBAN/).fill('EG110003000000000000123456789');
  await form.getByLabel(/SWIFT code/).fill('NBEGEGCX');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('bank-details-notice')).toHaveText('Your bank details were saved.');
  await expect(page.getByTestId('bank-details-saved')).toContainText('•••• 6789');
});
