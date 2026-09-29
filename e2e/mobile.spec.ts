import { expect, test } from '@playwright/test';

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
    await expect(drawer.getByRole('link', { name: 'Skin Care', exact: true })).toHaveAttribute('href', '/en/c/skin-care');
    await drawer.getByText('Body Care', { exact: true }).first().click();
    await expect(drawer.getByRole('link', { name: 'Body Scrub', exact: true })).toHaveAttribute('href', '/en/c/skin-care/body-care/body-scrub');

    await drawer.getByRole('button', { name: 'Close menu' }).click();
    await expect(drawer).toBeHidden();
  });

  test('Arabic fits the screen too', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
