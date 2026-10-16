import fs from 'node:fs';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acceptCookies, APP_URL, live, MOCK_API, resetMock, signInAsCustomer } from './support';

/*
 * The product page against the mock API (scripts/mock/product.mjs). Products are the home-page ones:
 *   9822  cologne 100 ml Dream: size buttons + scent swatches, rating, 23 reviews, related + bought together
 *   14400 Morning Dew (out of stock, notify-me) · 36510 200 ml (other scents unavailable)
 *   36480 bedtime bath 125 ml: 4 images + video · 8658 500 ml: discounted, size dropdown
 *   15472 coming soon · 33594 reviews off · 7346 English slug on /ar → redirect
 * Every text asserted here is read from the mock API first: the page must show it as it is.
 */

test.skip(live, 'needs the product states of the mock API');

type Locale = 'en' | 'ar';
const catalog = (locale: Locale) =>
  (JSON.parse(fs.readFileSync(`src/test/fixtures/v3/home.${locale}.json`, 'utf8')).data.sections as { products: { id: number; slug: string }[] }[]).flatMap(
    (s) => s.products,
  );
const slugOf = (id: number, locale: Locale = 'en') => catalog(locale).find((p) => p.id === id)!.slug;
const path = (id: number, locale: Locale = 'en') => `/${locale}/${encodeURIComponent(slugOf(id, locale))}`;

async function api<T>(request: APIRequestContext, endpoint: string, locale: Locale = 'en', token?: string): Promise<T> {
  const response = await request.get(`${MOCK_API}/api/customer/v3/${endpoint}`, {
    headers: { Accept: 'application/json', 'Accept-Language': locale, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  return (await response.json()).data as T;
}

interface Details {
  product: { name: string; price: { display: string; compareAtDisplay: string | null; discountLabel: string | null } };
  availability: { message: string | null };
  notices: { text: string }[];
  sku: string | null;
  seo: { title: string };
  specifications: { name: string; value: string }[];
  gallery: { url: string }[];
  video: { url: string } | null;
}
const details = (request: APIRequestContext, id: number, locale: Locale = 'en') => api<Details>(request, `products/${encodeURIComponent(slugOf(id, locale))}`, locale);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function open(page: Page, url: string) {
  await page.goto(url);
  // Buttons only work once the page is hydrated, and the streamed parts (recommendations, reviews) are in.
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('template[id^="B:"]'));
}

const header = (page: Page) => page.getByRole('banner');
const info = (page: Page) => page.getByTestId('product-info');
const actions = (page: Page, name: string) => page.getByTestId('product-info').getByRole('group', { name, exact: true });

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test.describe('product page', () => {
  test('shows the product as the API sent it', async ({ page, request, context }) => {
    const errors = collectErrors(page);
    const data = await details(request, 9822);
    await open(page, path(9822));

    await expect(page.getByRole('heading', { level: 1, name: data.product.name })).toBeVisible();
    await expect(page).toHaveTitle(new RegExp(`^${data.seo.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(decodeURIComponent(canonical ?? '')).toMatch(new RegExp(`/en/${slugOf(9822)}$`));
    await expect(info(page).getByTestId('product-price')).toHaveText(data.product.price.display);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Mom & Baby' })).toHaveAttribute('href', '/en/product/mom-baby');
    await expect(page.getByRole('main').getByRole('link', { name: 'JOHNSON & JOHNSON' }).first()).toHaveAttribute('href', '/en/product/brand/johnson-johnson');
    for (const notice of data.notices) await expect(page.getByTestId('product-notices')).toContainText(notice.text);
    await expect(page.getByTestId('product-sku')).toHaveText(data.sku!);
    for (const row of data.specifications) await expect(page.getByTestId('product-specifications')).toContainText(row.value);

    // recommendations and reviews stream in after the product
    const rows = await api<{ sections: { title: string; total: { display: string } | null }[] }>(request, `products/${encodeURIComponent(slugOf(9822))}/recommendations`);
    for (const section of rows.sections) await expect(page.getByRole('heading', { level: 2, name: section.title })).toBeVisible();
    await expect(page.getByTestId('together-total')).toHaveText(rows.sections.find((s) => s.total)!.total!.display);
    await expect(page.getByTestId('review')).toHaveCount(5);

    // browsing never starts a guest session
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_guest')).toBe(false);
    expect(errors).toEqual([]);
  });

  test('options are links to the products the backend chose', async ({ page }) => {
    await open(page, path(9822));
    const size = page.getByRole('group', { name: 'Size' });
    await expect(size.locator('[aria-current="true"]')).toContainText('100 ml');

    await size.getByRole('link', { name: '200 ml' }).click();
    await expect(page).toHaveURL(new RegExp(`${path(36510)}$`));
    // 200 ml exists only in Dream: the other scents are shown but cannot be clicked
    const scent = page.getByRole('group', { name: 'Scent' });
    await expect(scent.getByRole('link')).toHaveCount(0);
    await expect(scent.locator('[aria-disabled="true"]')).toHaveCount(2);

    await page.goto(path(9822));
    await page.getByRole('group', { name: 'Scent' }).getByRole('link', { name: 'Morning Dew, out of stock' }).click();
    await expect(page).toHaveURL(new RegExp(`${path(14400)}$`));
  });

  test('a guest adds the chosen quantity to the cart', async ({ page, request, context }) => {
    const data = await details(request, 9822);
    await open(page, path(9822));
    const buy = actions(page, data.product.name);

    await buy.getByRole('button', { name: 'Increase quantity' }).click();
    await expect(buy.getByTestId('product-quantity')).toHaveText('2');
    await buy.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.getByTestId('cart-toast')).toHaveText('Added to cart.');
    await expect(buy.getByRole('link', { name: 'In cart (2)' })).toHaveAttribute('href', '/en/cart');
    await expect(header(page).getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();

    const guest = (await context.cookies()).find((cookie) => cookie.name === 'sc_guest');
    expect(guest?.httpOnly).toBe(true);
    const cart = await api<{ items: { product: { id: number }; quantity: number }[] }>(request, 'cart', 'en', guest!.value);
    expect(cart.items.map((item) => [item.product.id, item.quantity])).toEqual([[9822, 2]]);
  });

  test('the signed-in customer saves to the wishlist and compares from the product page', async ({ page, request, context }) => {
    await signInAsCustomer(context, APP_URL);
    const data = await details(request, 9822);
    await open(page, path(9822));
    const buy = actions(page, data.product.name);

    await buy.getByRole('button', { name: 'Save to wishlist' }).click();
    await expect(buy.getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await expect(header(page).getByRole('link', { name: 'Wishlist, 4 items' })).toBeVisible();

    await buy.getByRole('button', { name: 'Compare', exact: true }).click();
    await expect(buy.getByRole('button', { name: 'Compare', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(header(page).getByRole('link', { name: 'Compare, 3 products' })).toBeVisible();
  });

  test('out of stock: a guest asks to be told, giving an email when the backend asks for one', async ({ page, request }) => {
    const data = await details(request, 14400);
    await open(page, path(14400));

    await expect(page.getByTestId('product-availability')).toHaveText(data.availability.message!);
    await expect(info(page).getByRole('button', { name: 'Add to cart' })).toBeDisabled();

    const notify = page.getByTestId('notify-me');
    await notify.getByRole('button', { name: 'Notify me when available' }).click();
    const email = notify.getByLabel('Email address');
    await expect(email).toBeFocused();
    await expect(email).toHaveAccessibleDescription('Enter your email so we can tell you when it is back.');

    await email.fill('sara@example.com');
    await notify.getByRole('button', { name: 'Notify me when available' }).click();
    await expect(notify.getByRole('status')).toHaveText("We'll let you know when it's back.");
  });

  test('notify-me: one click for the customer; the backend message when it is back in stock', async ({ page, request, context }) => {
    await signInAsCustomer(context, APP_URL);
    await open(page, path(14400));
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    await expect(page.getByTestId('notify-me').getByRole('status')).toHaveText("We'll let you know when it's back.");

    await page.reload();
    await page.waitForLoadState('networkidle');
    // it came back while the shopper was looking at the page
    await request.post(`${MOCK_API}/api/customer/v3/__mock/products/14400/restock`);
    await page.getByRole('button', { name: 'Notify me when available' }).click();
    await expect(page.getByTestId('notify-me').getByRole('status')).toHaveText('Good news: this product is back in stock. You can add it to your cart now.');
  });

  test('coming soon: the backend message and badge, nothing to buy, no SKU', async ({ page, request }) => {
    const data = await details(request, 15472);
    await open(page, path(15472));

    await expect(page.getByTestId('product-availability')).toHaveText(data.availability.message!);
    await expect(page.getByTestId('product-badges')).toContainText('Coming soon');
    await expect(info(page).getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    await expect(page.getByTestId('notify-me')).toHaveCount(0);
    await expect(page.getByTestId('product-sku')).toHaveCount(0);
  });

  test('discounted: price, old price and discount as the API wrote them; size as a dropdown', async ({ page, request }) => {
    const { price } = (await details(request, 8658)).product;
    await open(page, path(8658));

    const shown = info(page).getByTestId('product-price');
    await expect(shown).toContainText(price.display);
    await expect(shown.locator('s')).toContainText(price.compareAtDisplay!);
    await expect(page.getByTestId('product-discount')).toHaveText(price.discountLabel!);

    const dropdown = page.getByTestId('product-option');
    await dropdown.locator('summary').click();
    await dropdown.getByRole('link', { name: '125 ml' }).click();
    await expect(page).toHaveURL(new RegExp(`${path(36480)}$`));
  });

  test('gallery: thumbnails by mouse and keyboard, and the video', async ({ page, request }) => {
    const data = await details(request, 36480);
    await open(page, path(36480));
    const image = page.getByTestId('product-gallery-image');
    const thumbs = page.getByRole('list', { name: 'Product images' }).getByRole('button');

    await expect(thumbs).toHaveCount(data.gallery.length + 1);
    await expect(image).toHaveAttribute('src', data.gallery[0].url);
    await thumbs.nth(2).click();
    await expect(image).toHaveAttribute('src', data.gallery[2].url);
    await page.keyboard.press('ArrowRight');
    await expect(thumbs.nth(3)).toBeFocused();
    await expect(image).toHaveAttribute('src', data.gallery[3].url);

    await page.keyboard.press('End');
    const play = page.getByTestId('product-video').getByRole('link', { name: 'Play video' });
    await expect(play).toHaveAttribute('href', data.video!.url);
    await expect(play).toHaveAttribute('target', '_blank');
  });

  test('an English address in Arabic redirects permanently to the Arabic one', async ({ page, request }) => {
    const response = await request.get(`${APP_URL}/ar/${encodeURIComponent(slugOf(7346, 'en'))}`, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toContain(`/ar/${encodeURIComponent(slugOf(7346, 'ar'))}`);

    // the language switch lands on the same product in Arabic
    const arabic = await details(request, 7346, 'ar');
    await open(page, path(7346));
    await page.getByRole('link', { name: 'Switch language' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: arabic.product.name })).toBeVisible();
    expect(decodeURIComponent(new URL(page.url()).pathname)).toBe(`/ar/${slugOf(7346, 'ar')}`);
  });

  test('reviews: pages from the API, and none when the store switched them off', async ({ page, request }) => {
    const second = await api<{ items: { comment: string | null; author: string | null }[] }>(request, `products/${encodeURIComponent(slugOf(9822))}/reviews?page=2&perPage=5`);
    await open(page, path(9822));
    const reviews = page.getByRole('region', { name: 'Reviews' });

    await reviews.getByRole('navigation', { name: 'Review pages' }).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\?page=2#reviews$/);
    await expect(page.getByTestId('review').first()).toContainText(second.items[0].comment ?? second.items[0].author ?? 'A customer');
    await expect(page.getByRole('region', { name: 'Reviews' }).getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

    await open(page, path(33594));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Reviews' })).toHaveCount(0);
  });

  test('pictures that do not load show the store placeholder, not the broken-image icon', async ({ page }) => {
    await page.route(/\.(webp|jpe?g|png)(\?|$)/i, (route) => route.fulfill({ status: 404, body: '' }));
    await open(page, path(36480));
    const main = page.getByTestId('product-gallery-image');
    await expect(main).toHaveAttribute('data-placeholder', 'true');
    expect(await main.evaluate((el: HTMLImageElement) => el.naturalWidth > 0)).toBe(true);
    const thumbs = page.getByTestId('product-gallery').getByRole('listitem').locator('img');
    await expect(thumbs.first()).toHaveAttribute('data-placeholder', 'true');
  });

  test('an unknown product is a 404', async ({ page }) => {
    const response = await page.goto('/en/definitely-not-a-product');
    expect(response?.status()).toBe(404);
    await expect(page.getByText('Page not found')).toBeVisible();
  });

  test('says so when the store API is down', async ({ page, request }) => {
    await request.post(`${MOCK_API}/__mode`, { data: { fail: true } });
    try {
      await page.goto(path(9822));
      await expect(page.getByRole('heading', { name: 'The store is taking a break' })).toBeVisible();
    } finally {
      await request.post(`${MOCK_API}/__mode`, { data: { fail: false } });
    }
  });

  test('renders right-to-left Arabic', async ({ page, request }) => {
    const data = await details(request, 9822, 'ar');
    await open(page, path(9822, 'ar'));

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: data.product.name })).toBeVisible();
    await expect(info(page).getByTestId('product-price')).toHaveText(data.product.price.display);
    await expect(page.getByRole('group', { name: 'الحجم' }).getByRole('link', { name: '200 مل' })).toHaveAttribute('href', path(36510, 'ar'));
    await expect(info(page).getByRole('button', { name: 'أضف إلى السلة' })).toBeEnabled();
    await expect(page.getByRole('heading', { name: 'التقييمات' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('product page on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  for (const locale of ['en', 'ar'] as const) {
    test(`fits the screen (${locale})`, async ({ page }) => {
      await open(page, path(36480, locale));
      await expect(page.getByTestId('product-gallery-image')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const add = info(page).getByRole('button', { name: locale === 'en' ? 'Add to cart' : 'أضف إلى السلة' });
      await add.scrollIntoViewIfNeeded();
      const box = await add.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= 360).toBe(true);
    });
  }
});
