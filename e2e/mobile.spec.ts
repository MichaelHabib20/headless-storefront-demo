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

  // The menu item's raw link is /prescriptions: a store page (StorePageTarget), never /product/prescriptions.
  test('prescriptions from the menu drawer and the bottom nav: the sign-in card signed out, the page signed in (en, ar)', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await page.request.post(`${MOCK_API}/__reset`);
    const text = {
      en: { menu: 'Menu', item: 'Prescription', more: /More/, sheetItem: /Prescription/ },
      ar: { menu: 'القائمة', item: 'الروشتة الالكترونية', more: /المزيد/, sheetItem: /الوصفات الطبية/ },
    } as const;
    const landed = async (locale: string, signedIn: boolean) => {
      await expect(page).toHaveURL(new RegExp(`/${locale}/prescriptions$`));
      await expect(page.getByTestId(signedIn ? 'prescription-form' : 'account-sign-in')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    };
    for (const signedIn of [false, true]) {
      if (signedIn) await signInAsCustomer(context);
      for (const locale of ['en', 'ar'] as const) {
        const t = text[locale];
        // the menu drawer
        await page.goto(`/${locale}`);
        await page.getByRole('button', { name: t.menu, exact: true }).click();
        const link = page.getByRole('dialog', { name: t.menu }).getByRole('link', { name: t.item, exact: true });
        await expect(link).toHaveAttribute('href', `/${locale}/prescriptions`);
        await link.click();
        await landed(locale, signedIn);
        // the bottom nav's "more" sheet
        await page.goto(`/${locale}`);
        await page.getByTestId('mobile-bottom-nav').getByRole('button', { name: t.more }).click();
        const item = page.getByTestId('more-sheet').getByRole('link', { name: t.sheetItem });
        await expect(item).toHaveAttribute('href', `/${locale}/prescriptions`);
        await item.click();
        await landed(locale, signedIn);
      }
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

  for (const locale of ['en', 'ar'] as const) {
    test(`broken logo and category banner: the store name and the placeholder, never the broken-image icon (${locale})`, async ({ page }) => {
      test.skip(live, 'needs the mock API');
      // every picture file is missing (404)
      await page.route(/\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i, (route) => route.fulfill({ status: 404, body: '' }));
      await page.goto(`/${locale}/product/mom-baby`);
      const header = page.getByRole('banner');
      const store = JSON.parse(fs.readFileSync(`src/test/fixtures/v3/layout.${locale}.json`, 'utf8')).data.store as { name: string };
      await expect(header.getByTestId('store-logo-text')).toHaveText(store.name);
      await expect(header.getByTestId('store-logo')).toHaveCount(0);
      await expect(page.getByTestId('listing-image')).toHaveAttribute('data-placeholder', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test(`add to cart on a phone: the message, no drawer (${locale})`, async ({ page }) => {
      test.skip(live, 'needs the mock API');
      await page.request.post(`${MOCK_API}/__reset`);
      await page.goto(`/${locale}`);
      await page.getByTestId('product-card').first().getByRole('button', { name: locale === 'en' ? 'Add to cart' : 'أضف إلى السلة' }).click();
      const toast = page.getByTestId('cart-toast');
      await expect(toast).toHaveText(locale === 'en' ? 'Added to cart.' : 'تمت الإضافة إلى السلة.');
      await expect(page.getByTestId('mini-cart')).toHaveCount(0);
      await expect(toast).toBeInViewport();
      // above the WhatsApp button, never on it
      const box = (await toast.boundingBox())!;
      const chat = (await page.getByTestId('whatsapp').boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(chat.y);
    });

    test(`password reset without an online method: the contact note on a phone (${locale})`, async ({ page }) => {
      test.skip(live, 'needs the mock API');
      await page.request.post(`${MOCK_API}/__reset`);
      await page.request.post(`${MOCK_API}/__mode`, { data: { auth: { passwordReset: 'none' } } });
      await page.goto(`/${locale}/session/forgot-password`);
      const note = page.getByTestId('reset-unavailable');
      await expect(note.getByRole('link', { name: locale === 'en' ? 'Contact us' : 'اتصل بنا' })).toBeInViewport();
      await expect(note.getByRole('link', { name: locale === 'en' ? 'Chat on WhatsApp' : 'تواصل عبر واتساب' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.request.post(`${MOCK_API}/__reset`);
    });
  }

  test('Arabic fits the screen too', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // A touch phone shows the icon-only "Add to cart" (its label visually hidden, absolutely placed):
  // those labels used to hang off the page from the scrolled table and widen the whole page.
  test('compare with 4 products on a phone: the table scrolls inside its box, the page never does (en and ar)', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await page.request.post(`${MOCK_API}/__reset`);
    await signInAsCustomer(context);
    const headers = { Authorization: 'Bearer test-customer', Accept: 'application/json' };
    const listing = await (await page.request.get(`${MOCK_API}/api/customer/v3/products?perPage=8`, { headers })).json();
    for (const product of listing.data.items.slice(0, 6)) await page.request.put(`${MOCK_API}/api/customer/v3/compare/items/${product.id}`, { headers });
    for (const locale of ['en', 'ar']) {
      await page.goto(`/${locale}/compare`);
      await expect(page.getByTestId('compare-product')).toHaveCount(4);
      // what a store's card adds on a touch phone: a visually hidden label (absolutely placed) in each column
      await page.evaluate(() => {
        for (const cell of document.querySelectorAll('[data-testid="compare-product"]')) {
          const label = document.createElement('span');
          label.className = 'visually-hidden';
          label.textContent = 'Add to cart';
          cell.append(label);
        }
      });
      const scroller = page.getByTestId('compare-scroller');
      expect(await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      // the phone keeps its own width (a wide page makes it lay the page out wider) and nothing sticks out
      expect(await page.evaluate(() => window.innerWidth)).toBe(page.viewportSize()!.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const box = await page.getByRole('heading', { level: 1 }).boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    await page.request.post(`${MOCK_API}/__reset`);
  });

  test('the account menu on a phone: one column of icon rows, RTL too', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await signInAsCustomer(context);
    for (const locale of ['en', 'ar']) {
      await page.goto(`/${locale}/account`);
      const links = page.getByTestId('account-links').getByRole('link');
      await expect(links.first()).toBeVisible();
      const [first, second] = [await links.nth(0).boundingBox(), await links.nth(1).boundingBox()];
      expect(second!.y).toBeGreaterThan(first!.y + first!.height - 1);
      expect(Math.abs(second!.x - first!.x)).toBeLessThan(2);
      expect(await links.nth(0).locator('svg').count()).toBe(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  });

  test('a session ended on another device: the sign-in form on a phone, no redirect loop (ar)', async ({ page, context }) => {
    test.skip(live, 'needs the mock API');
    await page.request.post(`${MOCK_API}/__reset`);
    await signInAsCustomer(context);
    await page.request.post(`${MOCK_API}/__session`, { data: { revoke: 'test-customer' } });
    expect((await page.goto('/ar/account'))?.ok()).toBe(true);
    await expect(page.getByTestId('sign-in-form')).toBeVisible();
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_token')).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.request.post(`${MOCK_API}/__reset`);
  });
});
