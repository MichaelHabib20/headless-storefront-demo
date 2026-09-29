import { expect, test, type Page } from '@playwright/test';

const live = process.env.E2E_LIVE === '1';

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function acceptCookies(page: Page) {
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
}

test.describe('home page', () => {
  test('renders the store chrome and content in English', async ({ page }) => {
    const errors = collectErrors(page);
    await acceptCookies(page);
    await page.goto('/en');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('announcement')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Skin Care', exact: true })).toHaveAttribute('href', '/en/c/skin-care');
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.getByText('Find what you need, fast')).toBeVisible();
    await expect(page.getByTestId('promo-top-ad')).toBeVisible();

    const sections = page.getByTestId('home-section');
    await expect(sections.first()).toBeVisible();
    expect(await sections.count()).toBeGreaterThan(0);
    expect(await page.getByTestId('product-card').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('product-card').first()).toContainText(/EGP \d/);

    await expect(page.locator('footer')).toContainText('About Us');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('renders right-to-left Arabic', async ({ page }) => {
    const errors = collectErrors(page);
    await acceptCookies(page);
    await page.goto('/ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: 'تسوق حسب الفئة' })).toBeVisible();
    await expect(page.getByText('اعثر على ما تحتاجه بسرعة')).toBeVisible();
    await expect(page.getByTestId('promo-top-ad')).toBeVisible();
    await expect(page.getByTestId('product-card').first()).toContainText('ج.م');
    expect(errors).toEqual([]);
  });

  test('places brands right after categories, before the merchant sections', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/en');

    const categories = await page.getByRole('region', { name: 'Shop by category' }).elementHandle();
    const brands = await page.getByRole('region', { name: 'Brands' }).elementHandle();
    const firstSection = await page.getByTestId('home-section').first().elementHandle();

    const precedes = ([a, b]: (Element | null)[]) => Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(await page.evaluate(precedes, [categories, brands])).toBe(true);
    expect(await page.evaluate(precedes, [brands, firstSection])).toBe(true);
  });

  test('product and banner links lead to the planned pages', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/en');

    const productLink = page.getByTestId('product-card').first().getByRole('link');
    const href = await productLink.getAttribute('href');
    expect(href).toMatch(/^\/en\/p\/.+/);
    await productLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { name: 'Coming soon' })).toBeVisible();

    await page.getByRole('link', { name: 'Back to home' }).click();
    await expect(page).toHaveURL(/\/en$/);
  });

  test('switches language on the same page', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/en/deals');
    await page.getByRole('link', { name: 'Switch language' }).first().click();
    await expect(page).toHaveURL(/\/ar\/deals$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('redirects bare paths to a language', async ({ page, browser }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);

    const arabic = await browser.newContext({ locale: 'ar-EG', extraHTTPHeaders: { 'Accept-Language': 'ar-EG,ar;q=0.9' } });
    const arabicPage = await arabic.newPage();
    await arabicPage.goto('http://127.0.0.1:3200/');
    await expect(arabicPage).toHaveURL(/\/ar$/);
    await arabic.close();
  });

  test('unknown pages are 404', async ({ page }) => {
    const response = await page.goto('/en/definitely-not-a-page/x');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('shows the cookie notice until accepted', async ({ page }) => {
    await page.goto('/en');
    const notice = page.getByTestId('cookie-consent');
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'Accept' }).click();
    await expect(notice).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('cookie-consent')).toBeHidden();
  });

  test('says so when the store API is down', async ({ page, request }) => {
    test.skip(live, 'cannot break the live API');
    await request.post('http://127.0.0.1:4010/__mode', { data: { fail: true } });
    try {
      await page.goto('/en');
      await expect(page.getByRole('heading', { name: 'The store is taking a break' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en');
    } finally {
      await request.post('http://127.0.0.1:4010/__mode', { data: { fail: false } });
    }
  });
});
