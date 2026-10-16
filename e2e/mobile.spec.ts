import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { MOCK_API, live, signInAsCustomer } from './support';

test.describe('mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
  });

  test('fits the screen and opens the menu drawer', async ({ page }) => {
    await page.goto('/en');

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();

    await page.getByRole('button', { name: 'Menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu' });
    await expect(drawer).toBeVisible();
    // Categories with sub-categories expand; the first entry links to the whole category.
    await drawer.getByText('Skin Care', { exact: true }).first().click();
    await expect(drawer.getByRole('link', { name: 'Skin Care', exact: true })).toHaveAttribute('href', '/en/product/skin-care');
    await drawer.getByText('Body Care', { exact: true }).first().click();
    await expect(drawer.getByRole('link', { name: 'Body Scrub', exact: true })).toHaveAttribute('href', '/en/product/skin-care/body-care/body-scrub');

    await drawer.getByRole('button', { name: 'Close menu' }).click();
    await expect(drawer).toBeHidden();
  });

  test('all products (the old /all-products) on a phone, both languages', async ({ page }) => {
    for (const locale of ['en', 'ar']) {
      expect((await page.goto(`/${locale}/all-products`))?.status()).toBe(200);
      await expect(page.getByTestId('listing-grid').getByTestId('product-card').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('the deals of one category on a phone, both languages', async ({ page }) => {
    test.skip(live, 'needs the mock API catalog');
    for (const locale of ['en', 'ar']) {
      expect((await page.goto(`/${locale}/product/deals/mom-baby`))?.status()).toBe(200);
      await expect(page.getByTestId('listing-grid').getByTestId('product-card').first()).toBeVisible();
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/${locale}/product/deals/mom-baby$`));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('prescriptions on a phone: the bottom nav opens the page, both languages fit', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await page.request.post(`${MOCK_API}/__reset`);
    await signInAsCustomer(context);
    await page.goto('/en');
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: /More/ }).click();
    const item = page.getByTestId('more-sheet').getByRole('link', { name: /Prescription/ });
    await expect(item).toHaveAttribute('href', '/en/prescriptions');
    await item.click();
    await expect(page).toHaveURL(/\/en\/prescriptions$/);
    for (const locale of ['en', 'ar']) {
      await page.goto(`/${locale}/prescriptions`);
      await expect(page.getByTestId('prescription-form')).toBeVisible();
      await expect(page.getByTestId('prescription').first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('loyalty on a phone: the bottom nav opens the points page, both languages fit', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await page.request.post(`${MOCK_API}/__reset`);
    await page.request.post(`${MOCK_API}/__mode`, { data: { loyalty: { provider: 'elDokan' } } });
    await signInAsCustomer(context);
    await page.goto('/en');
    await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: /More/ }).click();
    const item = page.getByTestId('more-sheet').getByRole('link', { name: /Points/ });
    await expect(item).toHaveAttribute('href', '/en/account/your-points');
    await item.click();
    await expect(page).toHaveURL(/\/en\/account\/your-points$/);
    for (const locale of ['en', 'ar']) {
      for (const path of ['your-points', 'vouchers', 'vouchers/3', 'history', 'get-free-points']) {
        await page.goto(`/${locale}/account/${path}`);
        await expect(page.locator('h1')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale} ${path}`).toBe(true);
      }
    }
  });

  for (const locale of ['en', 'ar'] as const) {
    test(`390 px product page: the WhatsApp button never covers the title (${locale})`, async ({ page }) => {
      test.skip(live, 'needs the mock API');
      await page.setViewportSize({ width: 390, height: 844 });
      const home = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data.sections as { products: { id: number; slug: string }[] }[];
      const slug = home.flatMap((s) => s.products).find((p) => p.id === 36480)!.slug;
      await page.goto(`/${locale}/${encodeURIComponent(slug)}`);
      const button = page.getByTestId('whatsapp');
      await expect(button).toBeVisible();
      const title = page.getByRole('heading', { level: 1 });
      // Put the title's last line where the button is (the first view of a long gallery), then look for an overlap.
      const clash = await title.evaluate((h1) => {
        const lines = () => {
          const range = document.createRange();
          range.selectNodeContents(h1);
          return [...range.getClientRects()].filter((r) => r.width > 0);
        };
        const fab = document.querySelector('[data-testid="whatsapp"]')!.getBoundingClientRect();
        const last = lines().at(-1)!;
        window.scrollBy(0, last.top + last.height / 2 - (fab.top + fab.height / 2));
        const now = document.querySelector('[data-testid="whatsapp"]')!.getBoundingClientRect();
        return lines().some((r) => r.left < now.right && r.right > now.left && r.top < now.bottom && r.bottom > now.top);
      });
      expect(clash).toBe(false);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test('Arabic fits the screen too', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
