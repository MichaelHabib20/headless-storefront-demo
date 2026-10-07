import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, resetMock, signInAsCustomer } from './support';

/**
 * Prescriptions (the old /prescriptions and /add-address) against the mock API
 * (scripts/mock/prescriptions.mjs): the form the backend describes, its blockers, sending with
 * uploaded files, the list, cancelling. Every text asserted is the mock backend's or our i18n.
 */
test.skip(live, 'needs the stateful mock API (staging is checked read-only by hand)');

const AUTH = { Authorization: 'Bearer test-customer' };
const RX = { name: 'rx.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

async function mode(request: APIRequestContext, prescriptions: Record<string, unknown>) {
  await request.post(`${MOCK_API}/__mode`, { data: { prescriptions } });
}

async function onServer(request: APIRequestContext) {
  const response = await request.get(`${MOCK_API}/api/customer/v3/prescriptions`, { headers: AUTH });
  return (await response.json()).data.items as { id: string; status: { code: string }; fileCount: number }[];
}

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test('a visitor is asked to sign in, and no guest session is created', async ({ page, context }) => {
  await open(page, '/en/prescriptions');
  await expect(page.getByTestId('account-sign-in')).toBeVisible();
  await expect(page.getByTestId('account-sign-in').getByRole('link')).toHaveAttribute('href', /\/en\/session\/signin\?returnUrl=%2Fen%2Fprescriptions/);
  expect((await context.cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
  // a private page
  const response = await page.request.get('/en/prescriptions', { maxRedirects: 0 });
  expect(response.headers()['x-robots-tag']).toContain('noindex');
});

test('sends a prescription with photos, then sees it first in the list', async ({ page, context, request }) => {
  await signInAsCustomer(context);
  await open(page, '/en/prescriptions');
  await expect(page.getByRole('heading', { level: 1, name: 'Prescription' })).toBeVisible();
  await expect(page.getByTestId('prescription')).toHaveCount(2);

  // the API's 422: images are required by this store
  await page.getByRole('button', { name: 'Send prescription' }).click();
  await expect(page.getByText('Prescription photos is required.')).toBeVisible();
  expect(await onServer(request)).toHaveLength(2);

  await page.getByTestId('file-files').setInputFiles([RX, { ...RX, name: 'back.jpg' }]);
  await expect(page.getByTestId('files-files').getByRole('listitem')).toHaveCount(2);
  await page.getByLabel('Notes for the pharmacist').fill('Please call before delivery');
  await page.getByRole('button', { name: 'Send prescription' }).click();

  await expect(page.getByTestId('prescription-sent')).toHaveText('Thank you! We received your prescription and will contact you soon.');
  const saved = await onServer(request);
  expect(saved).toHaveLength(3);
  expect([saved[0].status.code, saved[0].fileCount]).toEqual(['received', 2]);
  await expect(page.getByTestId('prescription').first()).toHaveAttribute('data-id', saved[0].id);
});

test('cancels a received prescription with a reason; the one being prepared has no cancel', async ({ page, context, request }) => {
  await signInAsCustomer(context);
  await open(page, '/en/prescriptions');
  const prepared = page.getByTestId('prescription').filter({ has: page.getByText('#1041') });
  await expect(prepared.getByTestId('prescription-cancel')).toHaveCount(0);

  const received = page.getByTestId('prescription').filter({ has: page.getByText('#1042') });
  await received.getByTestId('prescription-cancel').click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this prescription?' });
  await dialog.getByLabel('Changed my mind').check();
  await dialog.getByRole('button', { name: 'Yes, cancel the prescription' }).click();

  await expect(received.getByTestId('prescription-status')).toHaveText('Cancelled');
  await expect(received.getByTestId('prescription-cancellation')).toHaveText('Cancelled: Changed my mind');
  expect((await onServer(request)).find((item) => item.id === '1042')?.status.code).toBe('cancelled');
});

test('blockers: verify the phone, or add an address first on /add-address and come back', async ({ page, context, request }) => {
  await signInAsCustomer(context);
  await mode(request, { phone: 'unverified' });
  await open(page, '/ar/prescriptions');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const blockers = page.getByTestId('prescription-blockers');
  await expect(blockers).toContainText('وثّق رقم هاتفك ليتمكن الصيدلي من الاتصال بك.');
  await expect(blockers.getByRole('link', { name: 'توثيق رقم هاتفي' })).toHaveAttribute('href', '/ar/verify-phone');
  await expect(page.getByRole('button', { name: 'إرسال الروشتة' })).toHaveCount(0);

  // no address: the address step (the old /add-address page), then back to the form
  await mode(request, { phone: 'ok' });
  const addresses = (await (await request.get(`${MOCK_API}/api/customer/v3/addresses`, { headers: AUTH })).json()).data.items as { id: number }[];
  for (const address of addresses) await request.delete(`${MOCK_API}/api/customer/v3/addresses/${address.id}`, { headers: AUTH });
  await open(page, '/en/prescriptions');
  await page.getByTestId('prescription-blockers').getByRole('link', { name: 'Add an address' }).click();
  await expect(page).toHaveURL(/\/en\/add-address$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Add your address' })).toBeVisible();
  await page.getByLabel('City').selectOption({ label: 'Giza' });
  await page.getByLabel('Area').selectOption({ label: 'Dokki' });
  await page.getByLabel('Street').fill('Tahrir St');
  await page.getByLabel('Building').fill('12');
  await page.getByLabel('Phone').fill('01000000002');
  await page.getByRole('button', { name: 'Save address' }).click();

  await expect(page).toHaveURL(/\/en\/prescriptions$/);
  await expect(page.getByRole('radio', { name: /Tahrir St/ })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Send prescription' })).toBeVisible();
});

test('Arabic, and 404 while the store takes no prescriptions', async ({ page, context, request }) => {
  await signInAsCustomer(context);
  await open(page, '/ar/prescriptions');
  await expect(page.getByRole('heading', { level: 1, name: 'روشتة' })).toBeVisible();
  await expect(page.getByTestId('prescription-status').first()).toHaveText('تم الاستلام');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await mode(request, { enabled: false });
  expect((await open(page, '/en/prescriptions'))?.status()).toBe(404);
});
