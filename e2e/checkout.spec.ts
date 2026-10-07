import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API } from './support';

/**
 * Checkout against the stateful mock API (scripts/mock/checkout.mjs + shopper.mjs).
 * "test-customer" has 36480 ×2 (18 EGP) and 7346 ×1 (160 EGP) = 196 EGP, below the 300 EGP minimum.
 * `fillCart()` puts 7346 at 2 → 356 EGP. Delivery to the default address (Nasr City) is 25 EGP,
 * pickup is free. Payment: 1 cash, 2 card on delivery (+10 EGP), 3 card online, 4 installments.
 * Every money text is the mock backend's: the page must show it as it is.
 */

test.skip(process.env.E2E_LIVE === '1', 'needs the stateful mock API');

const API = `${MOCK_API}/api/customer/v3`;
const CUSTOMER = { Authorization: 'Bearer test-customer' };

async function signIn(context: BrowserContext, token = 'test-customer', cookie = 'sc_token') {
  await context.addCookies([{ name: cookie, value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
}

async function fillCart(request: APIRequestContext, headers = CUSTOMER) {
  await request.put(`${API}/cart/items/7346`, { headers, data: { quantity: 2 } });
}

async function control(request: APIRequestContext, data: Record<string, unknown>) {
  await request.post(`${API}/__checkout`, { data });
}

/** What checkout created and what it sent (mock only). */
async function mockState(request: APIRequestContext, headers = CUSTOMER) {
  return (await (await request.get(`${API}/__checkout`, { headers })).json()) as {
    orders: string[];
    orderRequests: { idempotencyKey: string | null; body: { expectedTotal: number; selections: Record<string, unknown> } }[];
  };
}

async function openCheckout(page: Page, locale: 'en' | 'ar' = 'en') {
  await page.goto(`/${locale}/checkout`);
  // Choices only work once the page is hydrated.
  await page.waitForLoadState('networkidle');
}

const total = (page: Page) => page.getByTestId('checkout-total');
const placeButton = (page: Page) => page.getByTestId('place-order');

async function choosePayment(page: Page, name: string) {
  await page.getByRole('radio', { name }).check();
  await expect(page.getByTestId('checkout-updating')).toHaveCount(0);
}

async function place(page: Page) {
  await page.getByTestId('checkout-terms').check();
  await expect(placeButton(page)).toBeEnabled();
  await placeButton(page).click();
}

test.beforeEach(async ({ request, page }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
});

test.describe('checkout', () => {
  test('first visit: the backend preselects delivery, explains what is missing, and the button stays off', async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await signIn(context);
    await openCheckout(page);

    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page.getByTestId('fulfilment-delivery').getByRole('radio')).toBeChecked();
    await expect(page.getByTestId('checkout-address').getByRole('radio')).toBeChecked();
    await expect(page.getByTestId('checkout-delivery')).toContainText('25.00 EGP');
    await expect(total(page)).toHaveText('221.00 EGP');
    await expect(page.getByTestId('checkout-missing')).toContainText('Choose a payment method.');
    await expect(page.getByTestId('checkout-blockers')).toContainText('The minimum order is 300.00 EGP. Add 104.00 EGP more to check out.');
    await expect(page.getByTestId('cart-minimum-remaining')).toHaveText('104.00 EGP');
    await page.getByTestId('checkout-terms').check();
    await expect(placeButton(page)).toBeDisabled();
    await expect(page.getByTestId('checkout-add-address')).toHaveAttribute('href', '/en/account/address?next=checkout');
    expect(errors).toEqual([]);
  });

  test('offline order: placed, result page with the order, cart emptied, header count fresh', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();

    await choosePayment(page, 'Cash on delivery');
    await expect(total(page)).toHaveText('381.00 EGP');
    await page.getByRole('textbox', { name: 'Order note' }).fill('Ring the bell twice');
    await place(page);

    await expect(page).toHaveURL(/\/en\/checkout\/final-receipt\?checkout=mock-checkout-1$/);
    const result = page.getByTestId('checkout-result');
    await expect(result).toHaveAttribute('data-status', 'placed');
    await expect(page.getByRole('heading', { level: 1, name: 'Thank you for your order' })).toBeVisible();
    await expect(page.getByText('Thank you! We received your order.')).toBeVisible();
    await expect(page.getByTestId('result-order-number')).toHaveText('48211');
    await expect(page.getByTestId('result-item')).toHaveCount(2);
    await expect(page.getByTestId('result-payment')).toHaveText('Cash on delivery');
    await expect(page.getByText('Ring the bell twice')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('381.00 EGP');
    await expect(page.getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/en/account/order-history/mock-order-48211');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cart', exact: true })).toBeVisible();

    // the backend has the order, an empty cart, and got exactly the total that was on screen
    const state = await mockState(request);
    expect(state.orders).toEqual(['48211']);
    expect(state.orderRequests).toHaveLength(1);
    expect(state.orderRequests[0].body.expectedTotal).toBe(381);
    expect(state.orderRequests[0].body.selections).toMatchObject({ fulfilment: 'delivery', addressId: 501, paymentMethodId: 1, note: 'Ring the bell twice' });
    expect(state.orderRequests[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
    const cart = await (await request.get(`${API}/cart`, { headers: CUSTOMER })).json();
    expect(cart.data.items).toEqual([]);
  });

  test('a total that is not on screen can never be ordered: the page shows the new one and asks again', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Cash on delivery');
    await expect(total(page)).toHaveText('381.00 EGP');

    // the price changes on the backend between showing the checkout and the click
    await control(request, { price: { productId: 7346, amount: 170 } });
    await place(page);

    const problem = page.getByTestId('checkout-problem');
    await expect(problem).toHaveText('Your order total changed to 401.00 EGP. Please review it and confirm again.');
    await expect(problem).toBeFocused();
    await expect(total(page)).toHaveText('401.00 EGP');
    await expect(page).toHaveURL(/\/en\/checkout$/);
    // the old confirmation does not count for the new total
    await expect(page.getByTestId('checkout-terms')).not.toBeChecked();
    await expect(placeButton(page)).toBeDisabled();

    let state = await mockState(request);
    expect(state.orders).toEqual([]);
    expect(state.orderRequests.map((r) => r.body.expectedTotal)).toEqual([381]);

    // confirming the new total places it
    await place(page);
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    await expect(page.getByTestId('checkout-total')).toHaveText('401.00 EGP');
    state = await mockState(request);
    expect(state.orders).toHaveLength(1);
    expect(state.orderRequests.map((r) => r.body.expectedTotal)).toEqual([381, 401]);
    // a new attempt after a refusal gets a new key
    expect(state.orderRequests[0].idempotencyKey).not.toBe(state.orderRequests[1].idempotencyKey);
  });

  test('online payment, paid: to the payment page and back to the thank-you page', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Credit / debit card');
    await place(page);

    await expect(page).toHaveURL(new RegExp(`^${MOCK_API}/api/customer/v3/__pay\\?ref=`));
    await expect(page.getByTestId('pay-total')).toHaveText('381.00 EGP');
    await page.getByRole('link', { name: 'Pay', exact: true }).click();

    await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/en\/checkout\/final-receipt\?checkout=mock-checkout-1$/);
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'paid');
    await expect(page.getByText('Thank you! Your payment was received and your order is placed.')).toBeVisible();
    await expect(page.getByTestId('result-order-number')).toHaveText('48211');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cart', exact: true })).toBeVisible();
    expect((await mockState(request)).orderRequests[0].body).toMatchObject({ returnUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:\d+\/en\/checkout\/final-receipt$/) });
  });

  test('online payment, declined: the backend message and a way back to checkout; the cart is still there', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Credit / debit card');
    await place(page);
    await page.getByRole('link', { name: 'Card declined' }).click();

    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'failed');
    await expect(page.getByTestId('checkout-result').getByRole('alert')).toHaveText('The payment was declined. You were not charged.');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
    expect((await mockState(request)).orders).toEqual([]);

    // The pointer still rests where the bank page's link was; with the shell banners above the header that
    // spot is the desktop menu, which opens on hover over this link. Follow it from the keyboard instead.
    await page.getByRole('link', { name: 'Back to checkout' }).press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
    await expect(page.getByTestId('checkout-item')).toHaveCount(2);
  });

  test('online payment, pending then paid: the result page waits and asks again', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Credit / debit card');
    await place(page);
    await page.getByRole('link', { name: 'Pay — the bank confirms a few seconds later' }).click();

    const result = page.getByTestId('checkout-result');
    await expect(result).toHaveAttribute('data-status', 'pending');
    await expect(page.getByText('We are waiting for the bank to confirm your payment.')).toBeVisible();
    await expect(result).toHaveAttribute('data-status', 'paid', { timeout: 20_000 });
    await expect(page.getByTestId('result-order-number')).toHaveText('48211');
  });

  test('a result URL that says "paid" is not believed', async ({ page, context }) => {
    await signIn(context);
    await page.goto('/en/checkout/final-receipt?checkout=made-up&status=paid');
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'unknown');
    await expect(page.getByTestId('checkout-result').getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en/account/order-history');

    await page.goto('/en/checkout/final-receipt');
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'unknown');
  });

  test('promo codes: a discount line, an invalid code that blocks, and removing it', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Cash on delivery');

    const field = page.getByRole('textbox', { name: 'Promo code' });
    await field.fill('SAVE10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('promo-message')).toHaveText('10% off your items.');
    await expect(page.getByTestId('checkout-total-line').filter({ hasText: 'Promo code SAVE10' })).toContainText('-35.60 EGP');
    await expect(total(page)).toHaveText('345.40 EGP');

    await page.getByRole('button', { name: 'Remove code' }).click();
    await expect(total(page)).toHaveText('381.00 EGP');
    await field.fill('NOPE');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('promo-message')).toHaveText('This promo code is not valid.');
    await expect(page.getByTestId('checkout-blockers')).toContainText('Remove the promo code or enter a valid one.');
    await page.getByTestId('checkout-terms').check();
    await expect(placeButton(page)).toBeDisabled();

    await page.getByRole('button', { name: 'Remove code' }).click();
    await page.getByRole('textbox', { name: 'Promo code' }).fill('FREEDEL');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByTestId('checkout-delivery')).toContainText('Free');
    await expect(total(page)).toHaveText('356.00 EGP');
  });

  test('pickup: pick a branch, delivery is free text, and the order is placed for pickup', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);

    await page.getByRole('radio', { name: 'Click & Collect' }).check();
    await expect(page.getByTestId('checkout-missing')).toContainText('Choose a pickup branch.');
    await expect(page.getByTestId('checkout-branch')).toHaveCount(2);
    await page.getByRole('radio', { name: /Nasr City branch/ }).check();
    await choosePayment(page, 'Cash on delivery');

    await expect(page.getByTestId('checkout-delivery')).toContainText('Free — collect it from the branch');
    await expect(total(page)).toHaveText('356.00 EGP');
    await place(page);

    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    await expect(page.getByTestId('result-fulfilment')).toContainText('Nasr City branch');
  });

  test('installments need a plan; a payment fee is a line of the totals', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);

    await choosePayment(page, 'Card on delivery');
    await expect(page.getByTestId('checkout-total-line').filter({ hasText: 'Card on delivery fee' })).toContainText('10.00 EGP');
    await expect(total(page)).toHaveText('391.00 EGP');

    await choosePayment(page, 'Installments');
    await expect(page.getByTestId('checkout-missing')).toContainText('Choose an installment plan.');
    await page.getByRole('radio', { name: '12 months' }).check();
    await expect(page.getByTestId('checkout-missing')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: '12 months' })).toBeChecked();
  });

  test('the payment method changed: a clear accept step, then the order', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Credit / debit card');
    await control(request, { cardDown: true });
    await place(page);

    await expect(page.getByTestId('checkout-problem')).toHaveText('The payment method of your order changed. Please accept the change to continue.');
    await expect(page.getByTestId('checkout-messages')).toContainText('Your order will be paid with Cash on delivery instead.');
    await expect(page.getByRole('radio', { name: 'Cash on delivery' })).toBeChecked();
    await expect(placeButton(page)).toHaveText(/Accept and place order/);
    await expect(placeButton(page)).toBeDisabled();
    expect((await mockState(request)).orders).toEqual([]);

    await place(page);
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    const state = await mockState(request);
    expect(state.orderRequests.at(-1)?.body.selections).toMatchObject({ paymentMethodId: 1, acceptPaymentChange: true });
  });

  test('order in progress and payment provider errors: the message, no silent retry, no order', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page);
    await choosePayment(page, 'Cash on delivery');

    await control(request, { nextOrderError: 'order_in_progress' });
    await place(page);
    await expect(page.getByTestId('checkout-problem')).toHaveText('We are already placing an order for you. Please wait a moment.');
    await expect(page).toHaveURL(/\/en\/checkout$/);

    await control(request, { nextOrderError: 'payment_provider_error' });
    await placeButton(page).click();
    await expect(page.getByTestId('checkout-problem')).toHaveText('The payment provider did not answer. Please try again or choose another payment method.');

    const state = await mockState(request);
    expect(state.orders).toEqual([]);
    expect(state.orderRequests).toHaveLength(2);
    // order_in_progress: the retry was the same attempt
    expect(state.orderRequests[0].idempotencyKey).toBe(state.orderRequests[1].idempotencyKey);
  });

  test('a prescription is uploaded, listed and removed', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await request.put(`${API}/cart/items/14482`, { headers: CUSTOMER, data: { quantity: 1 } });
    await openCheckout(page);
    await choosePayment(page, 'Cash on delivery');

    await expect(page.getByTestId('checkout-missing')).toContainText('Upload your prescription.');
    await page.getByLabel('Upload a file').setInputFiles({ name: 'prescription.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fake image') });
    await expect(page.getByTestId('prescription-file')).toHaveText(/prescription\.jpg/);
    await expect(page.getByTestId('checkout-missing')).toHaveCount(0);

    await page.getByLabel('Upload a file').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(page.getByTestId('checkout-problem')).toHaveText('Upload a jpg, png, webp or pdf file.');

    await page.getByRole('button', { name: 'Remove file: prescription.jpg' }).click();
    await expect(page.getByTestId('prescription-file')).toHaveCount(0);
    await expect(page.getByTestId('checkout-missing')).toContainText('Upload your prescription.');
  });

  test('a guest gives contact details and places an order', async ({ page, context, request }) => {
    const guest = (await (await request.post(`${API}/session/guest`)).json()).data.token as string;
    await request.put(`${API}/cart/items/8658`, { headers: { Authorization: `Bearer ${guest}` }, data: { quantity: 2 } });
    await signIn(context, guest, 'sc_guest');
    await openCheckout(page);

    await expect(page.getByTestId('checkout-missing')).toContainText('Add your contact details.');
    const form = page.getByTestId('checkout-contact-form');
    await form.getByLabel('First name').fill('Mona');
    await form.getByLabel('Last name').fill('Ali');
    await form.getByLabel('Phone number').fill('12');
    await form.getByRole('button', { name: 'Save contact details' }).click();
    await expect(form.getByText('Enter a valid phone number.')).toBeVisible();

    await form.getByLabel('Phone number').fill('01234567890');
    await form.getByRole('button', { name: 'Save contact details' }).click();
    await expect(page.getByTestId('checkout-contact-details')).toContainText('Mona Ali');

    await page.getByRole('radio', { name: 'Click & Collect' }).check();
    await page.getByRole('radio', { name: /Dokki branch/ }).check();
    await choosePayment(page, 'Cash on delivery');
    await place(page);
    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    expect((await mockState(request, { Authorization: `Bearer ${guest}` })).orders).toHaveLength(1);
  });

  test('a guest is asked to sign in when the store needs an account', async ({ page, context, request }) => {
    const guest = (await (await request.post(`${API}/session/guest`)).json()).data.token as string;
    await request.put(`${API}/cart/items/8658`, { headers: { Authorization: `Bearer ${guest}` }, data: { quantity: 2 } });
    await control(request, { guestCheckout: false });
    await signIn(context, guest, 'sc_guest');
    await openCheckout(page);

    const prompt = page.getByTestId('checkout-sign-in');
    await expect(prompt).toContainText('Sign in to place your order.');
    await expect(prompt.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=checkout');
    await expect(page.getByTestId('checkout-blockers')).toContainText('This store needs an account to place an order.');
  });

  test('a visitor without a session sees the empty cart and no session is created', async ({ page, context }) => {
    await openCheckout(page);

    await expect(page.getByTestId('cart-empty')).toBeVisible();
    await expect(page.getByTestId('checkout-sign-in-hint').getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=checkout');
    await expect(page.getByTestId('place-order')).toHaveCount(0);
    expect((await context.cookies()).some((cookie) => cookie.name === 'sc_guest')).toBe(false);
  });

  test('Arabic: right-to-left, the API texts, and an order', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    await openCheckout(page, 'ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'إتمام الطلب' })).toBeVisible();
    await expect(page.getByTestId('checkout-missing')).toContainText('اختر طريقة الدفع.');
    await choosePayment(page, 'الدفع عند الاستلام');
    await expect(total(page)).toHaveText('381.00 جنية');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await place(page);

    await expect(page).toHaveURL(/\/ar\/checkout\/final-receipt\?checkout=/);
    await expect(page.getByRole('heading', { level: 1, name: 'شكراً لطلبك' })).toBeVisible();
    await expect(page.getByText('شكراً لك! استلمنا طلبك.')).toBeVisible();
    await expect(page.getByTestId('checkout-total')).toHaveText('381.00 جنية');
  });

  test('says so when the store API is down', async ({ page, context, request }) => {
    await signIn(context);
    await request.post(`${MOCK_API}/__mode`, { data: { fail: true } });
    try {
      await page.goto('/en/checkout');
      await expect(page.getByRole('heading', { name: 'The store is taking a break' })).toBeVisible();
    } finally {
      await request.post(`${MOCK_API}/__mode`, { data: { fail: false } });
    }
  });
});

test.describe('checkout on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

  test('fits the screen and places an order (en and ar)', async ({ page, context, request }) => {
    await signIn(context);
    await fillCart(request);
    for (const locale of ['ar', 'en'] as const) {
      await openCheckout(page, locale);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await choosePayment(page, 'Cash on delivery');
    await expect(total(page)).toHaveText('381.00 EGP');
    await page.getByTestId('checkout-terms').check();
    await placeButton(page).scrollIntoViewIfNeeded();
    await placeButton(page).tap();

    await expect(page.getByTestId('checkout-result')).toHaveAttribute('data-status', 'placed');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
