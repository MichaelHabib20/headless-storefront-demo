import { expect, test, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, signInAsCustomer } from './support';

/*
 * The site shell against the mock API (scripts/mock/shell.mjs): mini cart, bottom nav + "more"
 * sheet, app banner, top / floating banners, area chooser, maintenance, legal links, cookie notice.
 * Default mock mode = staging (app banner on, default bottom nav, legal pages, one inventory).
 */
const setMode = (page: Page, mode: Record<string, boolean>) => page.request.post(`${MOCK_API}/__mode`, { data: mode });

test.skip(live, 'the shell keys are not deployed on staging yet (mock only)');

/** The add-to-cart message and the WhatsApp button (both shown) do not overlap. */
async function expectClearOfWhatsApp(page: Page) {
  const toast = (await page.getByTestId('cart-toast').boundingBox())!;
  const chat = (await page.getByTestId('whatsapp').boundingBox())!;
  const overlaps = toast.x < chat.x + chat.width && chat.x < toast.x + toast.width && toast.y < chat.y + chat.height && chat.y < toast.y + toast.height;
  expect(overlaps, `toast ${JSON.stringify(toast)} vs WhatsApp ${JSON.stringify(chat)}`).toBe(false);
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK_API}/__reset`);
});

test.describe('desktop', () => {
  test.beforeEach(async ({ page }) => acceptCookies(page));

  test('add to cart shows a short message, not the drawer, like the old storefront; the header count follows', async ({ page }) => {
    await page.goto('/en');
    await page.getByTestId('product-card').first().getByRole('button', { name: 'Add to cart' }).click();
    const toast = page.getByTestId('cart-toast');
    await expect(toast).toHaveText('Added to cart.');
    await expect(page.getByTestId('mini-cart')).toHaveCount(0);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
    // bottom inline end (right in English), above the WhatsApp button, then it goes away by itself
    const box = (await toast.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(1440 - 40);
    expect(box.y + box.height).toBeGreaterThan(900 - 160);
    await expectClearOfWhatsApp(page);
    await expect(toast).toHaveCount(0, { timeout: 8000 });
  });

  test('Arabic: the add-to-cart message is bottom left, above the WhatsApp button, never on it', async ({ page }) => {
    await page.goto('/ar');
    await page.getByTestId('product-card').first().getByRole('button', { name: 'أضف إلى السلة' }).click();
    const toast = page.getByTestId('cart-toast');
    await expect(toast).toHaveText('تمت الإضافة إلى السلة.');
    const box = (await toast.boundingBox())!;
    expect(box.x).toBeLessThan(40);
    expect(box.y + box.height).toBeGreaterThan(900 - 160);
    await expectClearOfWhatsApp(page);
  });

  test('bottom nav is for phones only; legal links and the app banner are in the page', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByTestId('mobile-bottom-nav')).toBeHidden();
    const legal = page.getByRole('contentinfo').getByTestId('legal-links');
    await expect(legal.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/en/privacy-policy');
    await expect(legal.getByRole('link', { name: 'Terms and conditions' })).toHaveAttribute('href', '/en/terms-and-conditions');
    await expect(legal.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/en/cookie-policy');
    await expect(page.getByTestId('app-banner')).toContainText('Download App Now');
    await expect(page.getByTestId('usp-strip').getByRole('listitem')).toHaveCount(4);
  });

  test('app banner dismissal is remembered', async ({ page }) => {
    await page.goto('/en');
    await page.getByTestId('app-banner').getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByTestId('app-banner')).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('app-banner')).toHaveCount(0);
  });

  test('top and floating banners link through their Targets; the floating one closes', async ({ page }) => {
    await setMode(page, { banners: true });
    await page.goto('/ar');
    await expect(page.getByTestId('top-banner').getByRole('link')).toHaveAttribute('href', '/ar/products/deals');
    const floating = page.getByTestId('floating-banner');
    await expect(floating.getByRole('link')).toHaveAttribute('href', '/ar/landing-page/summer-sale');
    await floating.getByRole('button', { name: 'إغلاق العرض' }).click();
    await expect(floating).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('floating-banner')).toHaveCount(0);
    await expect(page.getByTestId('top-banner')).toBeVisible();
  });

  test('store not taking orders', async ({ page }) => {
    await setMode(page, { storeClosed: true });
    await page.goto('/en');
    await expect(page.getByTestId('store-closed')).toContainText('We take orders again tomorrow at 9 am.');
  });

  test('maintenance shows the merchant message (EN + AR)', async ({ page }) => {
    await setMode(page, { maintenance: true });
    await page.goto('/en');
    await expect(page.getByTestId('store-maintenance')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'We will be back soon' })).toBeVisible();
    await expect(page.getByText('We are upgrading — back shortly.')).toBeVisible();
    await page.goto('/ar/pages/about-us');
    await expect(page.getByText('نقوم بالتحديث — نعود قريباً')).toBeVisible();
    await setMode(page, { maintenance: false });
    await page.goto('/en');
    await expect(page.getByTestId('store-maintenance')).toHaveCount(0);
  });

  test('area chooser: forced for a shopper without an area, saved by the API', async ({ page, context }) => {
    await setMode(page, { multiInventory: true });
    await signInAsCustomer(context);
    await page.goto('/en');
    const dialog = page.getByTestId('area-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Choose your Governorate and City to see what is available near you.');

    // an area the store doesn't serve: the API's message
    await dialog.getByTestId('area-city').selectOption({ label: 'Giza' });
    await dialog.getByTestId('area-area').selectOption({ label: 'Remote Oasis' });
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('This area is not available. Please choose another one.');

    await dialog.getByTestId('area-city').selectOption({ label: 'Cairo' });
    await dialog.getByTestId('area-area').selectOption({ label: 'Maadi' });
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId('area-open')).toContainText('Maadi, Cairo');
    await page.reload();
    await expect(page.getByTestId('area-dialog')).toHaveCount(0);
    await expect(page.getByTestId('area-open')).toContainText('Maadi, Cairo');
  });

  test('area chooser: visitors without a session see it only when they open it', async ({ page }) => {
    await setMode(page, { multiInventory: true });
    await page.goto('/ar');
    await expect(page.getByTestId('area-strip')).toContainText('التوصيل إلى');
    await expect(page.getByTestId('area-dialog')).toHaveCount(0);
    expect((await page.context().cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
    await page.getByTestId('area-open').click();
    await expect(page.getByTestId('area-dialog')).toBeVisible();
  });
});

test.describe('cookie notice', () => {
  test('links the store cookie policy', async ({ page }) => {
    await page.goto('/en');
    const notice = page.getByTestId('cookie-consent');
    await expect(notice.getByRole('link', { name: 'Learn more' })).toHaveAttribute('href', '/en/cookie-policy');
  });
});

test.describe('phone (360 px)', () => {
  test.use({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true });

  test('bottom nav with badges and the more sheet; nothing overlaps; no sideways scroll', async ({ page, context }) => {
    await acceptCookies(page);
    await signInAsCustomer(context);
    await page.goto('/en');
    const nav = page.getByTestId('mobile-bottom-nav');
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link')).toHaveCount(4);
    await expect(nav.getByTestId('nav-badge-cart')).toHaveText('2');

    // app banner at the top, nav at the bottom, WhatsApp above the nav
    const bannerBox = (await page.getByTestId('app-banner').boundingBox())!;
    const navBox = (await nav.boundingBox())!;
    expect(bannerBox.y + bannerBox.height).toBeLessThanOrEqual(navBox.y);
    expect(navBox.y + navBox.height).toBeCloseTo(780, 0);
    const chat = await page.getByRole('link', { name: 'Chat on WhatsApp' }).boundingBox();
    if (chat) expect(chat.y + chat.height).toBeLessThanOrEqual(navBox.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

    await nav.getByRole('button', { name: /More/ }).click();
    const sheet = page.getByTestId('more-sheet');
    await expect(sheet.getByRole('link', { name: /Our Branches/ })).toHaveAttribute('href', '/en/pages/branches');
    await expect(sheet.getByTestId('nav-badge-wishlist')).toHaveText('3');
    await sheet.getByRole('link', { name: /Our Branches/ }).click();
    await expect(page).toHaveURL(/\/en\/pages\/branches$/);
    await expect(page.getByTestId('more-sheet')).toHaveCount(0);
  });

  test('Arabic bottom nav, language item and the cookie notice above the nav', async ({ page }) => {
    await page.goto('/ar');
    const nav = page.getByTestId('mobile-bottom-nav');
    await expect(nav.getByRole('link', { name: 'الرئيسية' })).toHaveAttribute('href', '/ar');
    const notice = (await page.getByTestId('cookie-consent').boundingBox())!;
    const navBox = (await nav.boundingBox())!;
    expect(notice.y + notice.height).toBeLessThanOrEqual(navBox.y);

    await nav.getByRole('button', { name: 'المزيد' }).click();
    await expect(page.getByTestId('more-sheet')).toContainText('مرحبا بك في صيدليات سيف!');
    await page.getByTestId('more-sheet').getByRole('link', { name: /English/ }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test('the add-to-cart message fits the phone above the bottom nav (Arabic: bottom left)', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/ar');
    await page.getByTestId('product-card').first().getByRole('button', { name: 'أضف إلى السلة' }).click();
    const toast = page.getByTestId('cart-toast');
    await expect(toast).toHaveText('تمت الإضافة إلى السلة.');
    await expect(page.getByTestId('mini-cart')).toHaveCount(0);
    await expect(toast).toBeInViewport();
    const box = (await toast.boundingBox())!;
    const nav = (await page.getByTestId('mobile-bottom-nav').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
    expect(box.x).toBeLessThan(40);
    expect(box.width).toBeLessThanOrEqual(360);
    await expectClearOfWhatsApp(page);
  });
});
