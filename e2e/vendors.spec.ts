import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Vendors (the old /vendors, its products?vendor_ids= listings and the home block) against the mock API
 * (scripts/mock/vendors.mjs + catalog.mjs): Green Farm (2 products) and City Pharmacy. Staging has
 * multi-vendor off.
 */
test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API (staging has multi-vendor off)');

async function vendors(request: APIRequestContext, data: Record<string, unknown>) {
  await request.post(`${MOCK_API}/__mode`, { data: { vendors: data } });
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

test('off (as on staging): no vendors page, no vendor listing, no home block', async ({ page }) => {
  expect((await open(page, '/en/vendors'))?.status()).toBe(404);
  expect((await open(page, '/en/vendors/3'))?.status()).toBe(404);
  await open(page, '/en');
  await expect(page.getByTestId('home-vendors')).toHaveCount(0);
});

test('home block → a vendor products → all vendors, in English and Arabic', async ({ page, request }) => {
  await vendors(request, { on: true });
  await open(page, '/en');
  const block = page.getByTestId('home-vendors');
  await expect(block.getByRole('heading', { name: 'Vendors' })).toBeVisible();
  await block.getByRole('link', { name: 'Green Farm' }).click();
  await expect(page).toHaveURL(/\/en\/vendors\/3$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Green Farm' })).toBeVisible();
  await expect(page.getByTestId('product-card')).toHaveCount(2);

  await open(page, '/en/vendors');
  await expect(page.getByRole('heading', { level: 1, name: 'Vendors' })).toBeVisible();
  await expect(page.getByTestId('brand-grid').getByRole('link')).toHaveCount(2);

  await open(page, '/ar/vendors');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { level: 1, name: 'البائعون' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'المزرعة الخضراء' })).toHaveAttribute('href', '/ar/vendors/3');
});

test('a store that hides vendors on its home page still has the vendors page', async ({ page, request }) => {
  await vendors(request, { on: true, home: false });
  await open(page, '/en');
  await expect(page.getByTestId('home-vendors')).toHaveCount(0);
  expect((await open(page, '/en/vendors'))?.status()).toBe(200);
  expect((await open(page, '/en/vendors/99'))?.status()).toBe(404);
});
