import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, resetMock, signInAsCustomer } from './support';

/**
 * Address book and orders against the stateful mock API (scripts/mock/account.mjs). The seeded
 * customer ("test-customer") has one default address (#501, Nasr City) and 12 orders: #48201 in
 * progress (can be cancelled), #48200 delivered (can be ordered again; one product is not sold any
 * more), #48199 picked up from a branch, #48198 cancelled, and older ones. Every text on screen is
 * the mock backend's, written like the real one: the pages must show it as it is.
 */
test.skip(live, 'needs the stateful mock API');

const AUTH = { Authorization: 'Bearer test-customer' };

async function addressesOnServer(request: APIRequestContext) {
  const response = await request.get(`${MOCK_API}/api/customer/v3/addresses`, { headers: AUTH });
  return (await response.json()).data.items as { id: number; isDefault: boolean; formatted: string; deliverable: boolean }[];
}

async function orderOnServer(request: APIRequestContext, id: string) {
  const response = await request.get(`${MOCK_API}/api/customer/v3/orders/${id}`, { headers: AUTH });
  return (await response.json()).data as { status: { code: string }; actions: { canCancel: boolean } };
}

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  // Buttons only work once the page is hydrated.
  await page.waitForLoadState('networkidle');
  return response;
}

const cards = (page: Page) => page.getByTestId('address');
const noHorizontalScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test.describe('address book', () => {
  test.beforeEach(async ({ context }) => signInAsCustomer(context));

  test('lists the saved addresses with the text the API wrote', async ({ page }) => {
    await open(page, '/en/account/address');

    await expect(page.getByRole('heading', { level: 1, name: 'My addresses' })).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText('Default address');
    await expect(cards(page).first().getByTestId('address-text')).toHaveText('12, 12 Abbas El Akkad St, Nasr City, Cairo');
    await expect(page.getByRole('link', { name: 'Add a new address' })).toHaveAttribute('href', '/en/account/address/add');
  });

  test('adds an address on the form the API describes, and shows its 422 messages next to the inputs', async ({ page, request }) => {
    await open(page, '/en/account/address/add');

    // location pickers fed by GET /locations: the areas of the chosen city
    await expect(page.getByLabel('Area')).toBeDisabled();
    await page.getByLabel('City').selectOption({ label: 'Giza' });
    await expect(page.getByLabel('Area').locator('option')).toHaveText(['Choose…', 'Dokki', 'Remote Oasis']);
    await expect(page.getByLabel(/Address name/)).not.toHaveAttribute('required', '');
    await page.getByLabel('Street').fill('Desert Rd');
    await page.getByLabel('Building').fill('4');
    await page.getByLabel('Phone').fill('123');
    await page.getByRole('button', { name: 'Save address' }).click();

    // the API refused: its messages, under the names it used
    await expect(page.getByText('Choose an area.')).toBeVisible();
    await expect(page.getByLabel('Phone')).toHaveAccessibleDescription('Enter a mobile number of 11 digits.');
    await expect(page.getByLabel('Area')).toBeFocused();
    await expect(page.getByLabel('Street')).toHaveValue('Desert Rd');
    expect(await addressesOnServer(request)).toHaveLength(1);

    await page.getByLabel('Area').selectOption({ label: 'Remote Oasis' });
    await page.getByLabel('Phone').fill('01000000002');
    await page.getByRole('button', { name: 'Save address' }).click();

    await expect(page).toHaveURL(/\/en\/account\/address\?saved=\d+$/);
    await expect(page.getByTestId('addresses-status')).toHaveText('The address was saved.');
    const added = cards(page).filter({ hasText: 'Desert Rd' });
    await expect(added.getByTestId('address-text')).toHaveText('4, Desert Rd, Remote Oasis, Giza');
    await expect(added.getByTestId('address-not-deliverable')).toHaveText('We do not deliver to this address at the moment.');
    expect(await addressesOnServer(request)).toHaveLength(2);
  });

  test('editing continues with the new id the API gives the address', async ({ page, request }) => {
    await open(page, '/en/account/address/edit/501');
    await expect(page.getByLabel('Street')).toHaveValue('12 Abbas El Akkad St');
    await page.getByLabel('Street').fill('90 Makram Ebeid St');
    await page.getByRole('button', { name: 'Save address' }).click();

    await expect(page).toHaveURL(/\?saved=\d+$/);
    const [saved] = await addressesOnServer(request);
    expect(saved.id).not.toBe(501);
    expect(page.url()).toContain(`saved=${saved.id}`);
    const card = cards(page).first();
    await expect(card).toHaveAttribute('data-address-id', String(saved.id));
    await expect(card.getByTestId('address-text')).toHaveText('12, 90 Makram Ebeid St, Nasr City, Cairo');
    await expect(card.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/en/account/address/edit/${saved.id}`);

    // the old id is gone
    const old = await open(page, '/en/account/address/edit/501');
    expect(old?.status()).toBe(404);
  });

  test('makes another address the default, and deleting the default picks another one', async ({ page, request }) => {
    await request.post(`${MOCK_API}/api/customer/v3/addresses`, {
      headers: AUTH,
      data: { cityId: 2, areaId: 21, values: { street: 'Tahrir St', building: '8', phone: '01000000003' } },
    });
    await open(page, '/en/account/address');
    await expect(cards(page)).toHaveCount(2);

    const dokki = cards(page).filter({ hasText: 'Dokki' });
    await dokki.getByRole('button', { name: 'Make default' }).click();
    await expect(page.getByTestId('addresses-status')).toHaveText('Your default address was changed.');
    await expect(cards(page).first()).toContainText('Dokki');
    await expect(cards(page).first()).toHaveAttribute('data-default', 'true');

    await cards(page).first().getByRole('button', { name: 'Delete' }).click();
    await expect(cards(page).first().getByText('Delete this address?')).toBeVisible();
    await cards(page).first().getByRole('button', { name: 'Yes, delete' }).click();

    await expect(page.getByTestId('addresses-status')).toHaveText('The address was deleted.');
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toHaveAttribute('data-default', 'true');
    expect(await addressesOnServer(request)).toEqual([expect.objectContaining({ id: 501, isDefault: true })]);
  });

  test('?next=checkout goes back to checkout after a save, and nowhere else', async ({ page }) => {
    await open(page, '/en/account/address?next=checkout');
    await expect(page.getByRole('link', { name: 'Back to checkout' })).toHaveAttribute('href', '/en/checkout');
    await page.getByRole('link', { name: 'Add a new address' }).click();
    await expect(page).toHaveURL(/\/en\/account\/address\/add\?next=checkout$/);
    await page.waitForLoadState('networkidle');

    await page.getByLabel('City').selectOption({ label: 'Cairo' });
    await page.getByLabel('Area').selectOption({ label: 'Maadi' });
    await page.getByLabel('Street').fill('Road 9');
    await page.getByLabel('Building').fill('20');
    await page.getByLabel('Phone').fill('01000000004');
    await page.getByRole('button', { name: 'Save address' }).click();
    await expect(page).toHaveURL(/\/en\/checkout$/);

    await open(page, '/en/account/address/add?next=https://evil.test');
    await page.getByLabel('City').selectOption({ label: 'Cairo' });
    await page.getByLabel('Area').selectOption({ label: 'Maadi' });
    await page.getByLabel('Street').fill('Road 10');
    await page.getByLabel('Building').fill('21');
    await page.getByLabel('Phone').fill('01000000005');
    await page.getByRole('button', { name: 'Save address' }).click();
    await expect(page).toHaveURL(/\/en\/account\/address\?saved=\d+$/);
  });

  test('works in Arabic, right to left', async ({ page }) => {
    await open(page, '/ar/account/address/add');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'عنوان جديد' })).toBeVisible();
    // labels as the API wrote them
    await expect(page.getByLabel('الشارع')).toBeVisible();
    await page.getByLabel('المدينة').selectOption({ label: 'الجيزة' });
    await expect(page.getByLabel('المنطقة').locator('option')).toHaveText(['اختر…', 'الدقي', 'الواحة البعيدة']);
    await page.getByLabel('الشارع').fill('شارع التحرير');
    await page.getByLabel('المبنى').fill('8');
    await page.getByLabel('رقم الهاتف').fill('01000000003');
    await page.getByRole('button', { name: 'حفظ العنوان' }).click();
    await expect(page.getByText('اختر المنطقة.')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test.describe('orders', () => {
  test.beforeEach(async ({ context }) => signInAsCustomer(context));

  test('lists the orders as the API sent them, with pages', async ({ page }) => {
    await open(page, '/en/account/order-history');

    await expect(page.getByRole('heading', { level: 1, name: 'My orders' })).toBeVisible();
    const rows = page.getByTestId('order-summary');
    await expect(rows).toHaveCount(10);
    const first = rows.first();
    await expect(first.getByRole('link', { name: 'Order #48201' })).toHaveAttribute('href', '/en/account/order-history/mock-order-48201');
    await expect(first.getByTestId('order-status')).toHaveText('Being prepared');
    await expect(first.getByTestId('order-total')).toHaveText('408.00 EGP');
    await expect(first.getByTestId('order-item-count')).toHaveText('3');
    // placed 01:10 store time (22:10 UTC the day before): the store's date, whatever the server's time zone
    await expect(first).toContainText('September 28, 2026');
    await expect(first.locator('time')).toHaveAttribute('datetime', '2026-09-28T01:10:11+03:00');

    await page.getByRole('navigation', { name: 'Order pages' }).getByRole('link', { name: 'Next' }).click();
    await expect(page).toHaveURL(/\/en\/account\/order-history\?page=2$/);
    await expect(rows).toHaveCount(2);
  });

  test('shows an order: steps, address, payment, lines and the price breakdown', async ({ page }) => {
    await open(page, '/en/account/order-history/mock-order-48201');

    await expect(page.getByRole('heading', { level: 1, name: 'Order #48201' })).toBeVisible();
    await expect(page.locator('time[datetime="2026-09-28T01:10:11+03:00"]')).toHaveText('September 28, 2026');
    await expect(page.getByTestId('order-status')).toHaveText('Being prepared');
    await expect(page.getByTestId('order-timeline').locator('[aria-current="step"]')).toContainText('Being prepared');
    await expect(page.getByTestId('order-fulfilment')).toContainText('12, 12 Abbas El Akkad St, Nasr City, Cairo');
    await expect(page.getByTestId('order-payment')).toContainText('Cash on delivery');

    const items = page.getByTestId('order-item');
    await expect(items).toHaveCount(2);
    await expect(items.nth(1).getByTestId('order-item-total')).toHaveText('243.00 EGP');
    await expect(items.nth(1).getByTestId('order-item-compare-at')).toHaveText('270.00 EGP');
    await expect(items.first().getByRole('link')).toHaveAttribute('href', /^\/en\/.+/);

    const lines = page.getByTestId('order-total-line');
    await expect(lines).toHaveText([/Subtotal\s*403\.00 EGP/, /Promo code SAVE20\s*-20\.00 EGP/, /Delivery\s*25\.00 EGP/]);
    await expect(page.getByTestId('order-grand-total')).toHaveText('408.00 EGP');
    await expect(page.getByTestId('order-note')).toHaveText('Please call me before you arrive.');

    // actions from the API: cancel yes, order again no
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Order again' })).toHaveCount(0);
  });

  test('a pickup order shows the branch and the text the API sent instead of an amount', async ({ page }) => {
    await open(page, '/en/account/order-history/mock-order-48199');
    await expect(page.getByTestId('order-fulfilment')).toContainText('Nasr City branch');
    await expect(page.getByTestId('order-fulfilment').getByRole('link', { name: 'Open in maps' })).toHaveAttribute('target', '_blank');
    await expect(page.getByTestId('order-total-line').last()).toHaveText(/Pickup from the branch\s*Free/);
    await expect(page.getByTestId('order-timeline')).toHaveCount(0);
  });

  test('cancels an order with a reason and a note', async ({ page, request }) => {
    await open(page, '/en/account/order-history/mock-order-48201');
    await page.getByRole('button', { name: 'Cancel order' }).click();

    const dialog = page.getByRole('dialog', { name: 'Cancel this order?' });
    await expect(dialog.getByRole('radio')).toHaveCount(4);
    await expect(dialog.getByRole('radio').first()).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Yes, cancel the order' })).toBeDisabled();
    await dialog.getByLabel('I ordered by mistake').check();
    await dialog.getByLabel(/Anything else/).fill('Ordered twice');
    await dialog.getByRole('button', { name: 'Yes, cancel the order' }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('order-actions-status')).toHaveText('Your order was cancelled.');
    await expect(page.getByTestId('order-status')).toHaveText('Cancelled');
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    expect((await orderOnServer(request, 'mock-order-48201')).status.code).toBe('cancelled');
  });

  test("409 cannot_cancel: shows the backend's message and the order as it is now", async ({ page, request }) => {
    await open(page, '/en/account/order-history/mock-order-48201');
    // cancelled meanwhile (e.g. on another device)
    await request.post(`${MOCK_API}/api/customer/v3/orders/mock-order-48201/cancel`, { headers: AUTH, data: { reasonId: 1 } });

    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('dialog').getByLabel('I changed my mind').check();
    await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel the order' }).click();

    await expect(page.getByTestId('order-actions-status').getByRole('alert')).toHaveText('This order can no longer be cancelled.');
    await expect(page.getByTestId('order-status')).toHaveText('Cancelled');
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  });

  test('orders again: goes to the cart, says what was skipped, the header count is fresh', async ({ page, request }) => {
    await open(page, '/en/account/order-history/mock-order-48200');
    await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
    await page.getByRole('button', { name: 'Order again' }).click();

    await expect(page).toHaveURL(/\/en\/cart$/);
    const notice = page.getByTestId('reorder-notice');
    await expect(notice).toContainText('The items of your order were added to your cart.');
    await expect(notice.getByTestId('reorder-skipped')).toHaveText(['Baby Wipes Travel Pack — This product is no longer sold.']);
    await expect(page.getByTestId('cart-line')).toHaveCount(3);
    await expect(page.getByRole('link', { name: 'Cart, 3 items' })).toBeVisible();
    const me = await (await request.get(`${MOCK_API}/api/customer/v3/me`, { headers: AUTH })).json();
    expect(me.data.counts.cart).toBe(3);

    // shown once
    await page.reload();
    await expect(page.getByTestId('cart-line')).toHaveCount(3);
    await expect(page.getByTestId('reorder-notice')).toHaveCount(0);
  });

  test("answers 404 for an order that isn't the shopper's", async ({ page }) => {
    const response = await page.goto('/en/account/order-history/mock-order-99999');
    expect(response?.status()).toBe(404);
  });

  test('works in Arabic, right to left', async ({ page }) => {
    await open(page, '/ar/account/order-history/mock-order-48200');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'طلب رقم 48200' })).toBeVisible();
    await expect(page.getByTestId('order-status')).toHaveText('تم التوصيل');
    await expect(page.getByTestId('order-grand-total')).toHaveText('192.40 جنية');
    await expect(page.getByTestId('order-total-line').nth(1)).toHaveText(/عرض نهاية الأسبوع\s*-15\.00 جنية/);
    await expect(page.getByRole('button', { name: 'اطلب مرة أخرى' })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    await open(page, '/ar/account/order-history');
    await expect(page.getByTestId('order-summary').first()).toContainText('28 سبتمبر 2026');
  });
});

test.describe('without a session', () => {
  test('asks to sign in and come back, and never starts a guest session', async ({ page, context }) => {
    for (const path of ['/en/account/order-history', '/en/account/address', '/en/account/order-history/mock-order-48201', '/en/account/address/add']) {
      await open(page, path);
      await expect(page.getByTestId('account-sign-in')).toBeVisible();
      await expect(page.getByTestId('account-sign-in').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', `/en/session/signin?returnUrl=${encodeURIComponent(path)}`);
    }
    await expect(page.getByTestId('address-form')).toHaveCount(0);
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_guest')).toBe(false);
  });

  test('an unknown token is treated the same way', async ({ page, context }) => {
    await context.addCookies([{ name: 'sc_token', value: 'expired-token', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    await open(page, '/en/account/order-history');
    await expect(page.getByTestId('account-sign-in')).toBeVisible();
  });
});

test.describe('on a phone (360 px)', () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test.beforeEach(async ({ context }) => signInAsCustomer(context));

  test('the pages fit the screen', async ({ page }) => {
    for (const path of ['/en/account/order-history', '/en/account/order-history/mock-order-48201', '/ar/account/address', '/en/account/address/add']) {
      await open(page, path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await noHorizontalScroll(page), path).toBe(true);
    }
    await open(page, '/en/account/order-history/mock-order-48201');
    await page.getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByRole('dialog')).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cancel order' })).toBeFocused();
  });
});
