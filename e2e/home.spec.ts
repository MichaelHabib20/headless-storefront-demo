import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { APP_URL, MOCK_API } from './support';

const live = process.env.E2E_LIVE === '1';
const API = live ? (process.env.SC_API_URL ?? 'https://staging-seif.witheldokan.com').replace(/\/+$/, '') : MOCK_API;

/** The price text the API sends for the first product on the home page (mock or live). */
async function firstPriceText(request: APIRequestContext, locale: 'en' | 'ar'): Promise<string> {
  const response = await request.get(`${API}/api/customer/v3/home`, { headers: { Accept: 'application/json', 'Accept-Language': locale } });
  const home = (await response.json()).data as { sections: { products: { price: { display: string } | null }[] }[] };
  const price = home.sections.flatMap((section) => section.products)[0]?.price;
  if (!price) throw new Error('the first product on the home page has no price');
  return price.display;
}

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
  test('renders the store chrome and content in English', async ({ page, request }) => {
    const errors = collectErrors(page);
    await acceptCookies(page);
    await page.goto('/en');

    await expect(page).toHaveTitle(/.+/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('announcement')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Skin Care', exact: true })).toHaveAttribute('href', '/en/c/skin-care');
    await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
    await expect(page.getByTestId('promo-top-ad')).toBeVisible();

    const sections = page.getByTestId('home-section');
    await expect(sections.first()).toBeVisible();
    expect(await sections.count()).toBeGreaterThan(0);
    expect(await page.getByTestId('product-card').count()).toBeGreaterThan(0);
    // the card shows the API's price text as it is, whatever its format
    await expect(page.getByTestId('product-card').first().getByTestId('product-price')).toHaveText(await firstPriceText(request, 'en'));

    await expect(page.locator('footer')).toContainText('About Us');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('renders right-to-left Arabic', async ({ page, request }) => {
    const errors = collectErrors(page);
    await acceptCookies(page);
    await page.goto('/ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.getByRole('heading', { name: 'تسوق حسب الفئة' })).toBeVisible();
    await expect(page.getByTestId('promo-top-ad')).toBeVisible();
    await expect(page.getByTestId('product-card').first().getByTestId('product-price')).toHaveText(await firstPriceText(request, 'ar'));
    expect(errors).toEqual([]);
  });

  test('product links lead to the product page', async ({ page }) => {
    await acceptCookies(page);
    await page.goto('/en');

    const card = page.getByTestId('product-card').first();
    const name = (await card.getByRole('heading').textContent())?.trim() ?? '';
    const productLink = card.getByRole('link');
    const href = await productLink.getAttribute('href');
    expect(href).toMatch(/^\/en\/p\/.+/);
    await productLink.click();
    // rendered on demand: allow for a slow first render
    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
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
    await arabicPage.goto(`${APP_URL}/`);
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
    await request.post(`${MOCK_API}/__mode`, { data: { fail: true } });
    try {
      await page.goto('/en');
      await expect(page.getByRole('heading', { name: 'The store is taking a break' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en');
    } finally {
      await request.post(`${MOCK_API}/__mode`, { data: { fail: false } });
    }
  });
});
