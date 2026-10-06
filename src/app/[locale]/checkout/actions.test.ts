import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkoutSelections, createStorefrontClient, type Checkout } from '@/sdk';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { checkoutReturnUrl } from '@/lib/site.server';
import { checkoutFixture, pickupCheckoutFixture } from '@/test/checkout-fixtures';
import { computeCheckoutAction, placeOrderAction, saveContactAction, uploadPrescriptionAction } from './actions';

/*
 * The real SDK runs here against a fake `fetch`, so these tests see the exact HTTP requests the
 * backend would get — in particular what POST /orders carries.
 */
const http = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/lib/storefront.server', () => ({
  storefrontClient: () => createStorefrontClient({ baseUrl: 'https://api.test', fetch: http.fetch as unknown as typeof fetch }),
}));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn() }));
vi.mock('@/lib/site.server', () => ({ checkoutReturnUrl: vi.fn() }));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function respond(status: number, body: unknown) {
  http.fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
}

function request(index = -1) {
  const [url, init] = http.fetch.mock.calls.at(index) as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : init.body,
  };
}

const done = (reference = 'ref-1') => ({ data: { next: { type: 'done', url: null, reference }, order: null } });
const place = (checkout: Checkout, extra: Partial<Parameters<typeof placeOrderAction>[1]> = {}) =>
  placeOrderAction('en', { checkout, note: '', acceptTerms: true, attemptKey: 'attempt-key-1', acceptPaymentChange: false, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  http.fetch.mockReset();
  vi.mocked(shopperContext).mockImplementation(async (locale) => ({ locale, token: 'shopper-token' }));
  vi.mocked(checkoutReturnUrl).mockImplementation(async (locale) => `https://shop.test/${locale}/checkout/result`);
});

describe('placeOrderAction', () => {
  it('sends exactly the choices and the total of the checkout it was given', async () => {
    const checkout = pickupCheckoutFixture('en');
    checkout.payment.selected = { methodId: 4, planId: 42 };
    checkout.requirements.prescription = { required: true, files: [{ id: 'up-7', name: 'rx.pdf' }] };
    checkout.canPlaceOrder = true;
    // a total no formula in the storefront could come up with: it can only have been passed through
    checkout.totals.total = { amount: 987.654321, currency: 'EGP', display: 'TOTAL-ON-SCREEN' };
    respond(200, done('ref-9'));

    const outcome = await place(checkout, { note: '  Ring twice ' });

    expect(outcome).toEqual({ ok: true, url: '/en/checkout/result?checkout=ref-9' });
    expect(http.fetch).toHaveBeenCalledTimes(1);
    const sent = request();
    expect(sent.url).toBe('https://api.test/api/customer/v3/orders');
    expect(sent.method).toBe('POST');
    expect(sent.headers).toMatchObject({ Authorization: 'Bearer shopper-token', 'Idempotency-Key': 'attempt-key-1', 'Accept-Language': 'en' });
    expect(sent.body).toEqual({
      selections: {
        fulfilment: 'pickup',
        addressId: null,
        branchId: 71,
        paymentMethodId: 4,
        installmentPlanId: 42,
        promoCode: 'SAVE10',
        prescriptionFiles: ['up-7'],
        useWallet: false,
        note: 'Ring twice',
      },
      expectedTotal: 987.654321,
      acceptTerms: true,
      returnUrl: 'https://shop.test/en/checkout/result',
    });
    // nothing else of the checkout leaks into the request: the selections are its echo
    expect((sent.body as { selections: unknown }).selections).toEqual({ ...checkoutSelections(checkout), note: 'Ring twice' });
  });

  it('two different checkouts give two different requests (nothing is remembered or defaulted)', async () => {
    respond(200, done());
    respond(200, done());
    const delivery = checkoutFixture('ar');

    await placeOrderAction('ar', { checkout: delivery, note: '', acceptTerms: true, attemptKey: 'attempt-key-2', acceptPaymentChange: false });

    expect(request().headers['Accept-Language']).toBe('ar');
    expect(request().body).toEqual({
      selections: { ...checkoutSelections(delivery), note: null },
      expectedTotal: delivery.totals.total.amount,
      acceptTerms: true,
      returnUrl: 'https://shop.test/ar/checkout/result',
    });
    expect(checkoutReturnUrl).toHaveBeenCalledWith('ar');
  });

  it('never starts a guest session and needs a shopper', async () => {
    vi.mocked(shopperContext).mockResolvedValue({ locale: 'en', token: null });

    const outcome = await place(checkoutFixture('en'));

    expect(outcome).toEqual({ ok: false, message: 'Your session has expired. Reload the page and try again.', attemptKey: 'attempt-key-1' });
    expect(http.fetch).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('does not call the backend without the terms, for a checkout that can not be placed, or for something that is not a checkout', async () => {
    const blocked = checkoutFixture('en');
    blocked.canPlaceOrder = false;

    expect(await place(checkoutFixture('en'), { acceptTerms: false })).toMatchObject({ ok: false, message: 'Accept the terms and conditions to place your order.' });
    expect(await place(blocked)).toMatchObject({ ok: false, message: 'Your order is not ready to be placed yet.' });
    expect(await place({ totals: { total: { amount: 1 } } } as unknown as Checkout)).toMatchObject({ ok: false, message: 'We could not confirm your order. Please try again.' });
    expect(await place(null as unknown as Checkout)).toMatchObject({ ok: false });
    expect(http.fetch).not.toHaveBeenCalled();
  });

  it('online payment: sends the browser to the payment page, only when it is an http(s) URL', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(200, { data: { next: { type: 'redirect', url: 'https://pay.example/session/abc', reference: 'ref-2' }, order: null } });
    expect(await place(checkoutFixture('en'))).toEqual({ ok: true, url: 'https://pay.example/session/abc' });

    for (const url of ['javascript:alert(1)', '/relative', null]) {
      respond(200, { data: { next: { type: 'redirect', url, reference: 'ref-3' }, order: null } });
      const outcome = await place(checkoutFixture('en'));
      expect(outcome).toMatchObject({ ok: false, message: 'The payment page could not be opened. Try again or choose another payment method.' });
    }
    log.mockRestore();
  });

  it('a next step it does not know goes to the result page, which asks the backend', async () => {
    respond(200, { data: { next: { type: 'something_new', url: null, reference: 'ref 5' }, order: null } });
    expect(await place(checkoutFixture('en'))).toEqual({ ok: true, url: '/en/checkout/result?checkout=ref%205' });
  });

  it.each(['total_changed', 'checkout_incomplete'] as const)('%s: hands back the fresh checkout and the backend message, with a new key', async (code) => {
    const fresh = pickupCheckoutFixture('en');
    respond(409, { error: { code, message: 'Please review your order.' }, checkout: fresh });

    const outcome = await place(checkoutFixture('en'));

    expect(outcome).toEqual({ ok: false, message: 'Please review your order.', checkout: fresh, needsConsent: false, attemptKey: expect.stringMatching(UUID) });
    // never retried silently
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });

  it('payment_change_needs_consent: asks for consent, then sends acceptPaymentChange with the fresh checkout', async () => {
    const fresh = checkoutFixture('en');
    fresh.totals.total = { amount: 391, currency: 'EGP', display: 'NEW-TOTAL' };
    respond(409, { error: { code: 'payment_change_needs_consent', message: 'Please accept the change.' }, checkout: fresh });

    const asked = await place(checkoutFixture('en'));
    expect(asked).toMatchObject({ ok: false, message: 'Please accept the change.', checkout: fresh, needsConsent: true });
    expect((request().body as { selections: object }).selections).not.toHaveProperty('acceptPaymentChange');

    respond(200, done('ref-6'));
    const accepted = await place(fresh, { acceptPaymentChange: true, attemptKey: (asked as { attemptKey: string }).attemptKey });

    expect(accepted).toEqual({ ok: true, url: '/en/checkout/result?checkout=ref-6' });
    expect(request().body).toMatchObject({ expectedTotal: 391, selections: { acceptPaymentChange: true } });
    expect(request().headers['Idempotency-Key']).toMatch(UUID);
  });

  it('computes again when a refusal comes without its checkout', async () => {
    const fresh = pickupCheckoutFixture('en');
    respond(409, { error: { code: 'total_changed', message: 'The total changed.' } });
    respond(200, { data: fresh });
    const shown = checkoutFixture('en');

    const outcome = await place(shown);

    expect(outcome).toMatchObject({ ok: false, message: 'The total changed.', checkout: fresh });
    expect(request().url).toBe('https://api.test/api/customer/v3/checkout');
    expect(request().body).toEqual(checkoutSelections(shown));
  });

  it.each([
    ['payment_provider_error', 502, 'The payment provider did not answer.'],
    ['guest_checkout_disabled', 403, 'This store needs an account to place an order.'],
  ] as const)('%s: the backend message, no checkout, a new key', async (code, status, message) => {
    respond(status, { error: { code, message } });
    const outcome = await place(checkoutFixture('en'));
    expect(outcome).toEqual({ ok: false, message, attemptKey: expect.stringMatching(UUID) });
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });

  it('validation: the first field message', async () => {
    respond(422, { error: { code: 'validation_failed', message: 'Please check the highlighted fields.', fields: { returnUrl: ['A return URL is needed for online payments.'] } } });
    expect(await place(checkoutFixture('en'))).toMatchObject({ ok: false, message: 'A return URL is needed for online payments.' });
  });

  it('order_in_progress and unknown outcomes keep the same key, so the next click is a retry and never a second order', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(409, { error: { code: 'order_in_progress', message: 'We are already placing an order for you.' } });
    expect(await place(checkoutFixture('en'))).toEqual({ ok: false, message: 'We are already placing an order for you.', attemptKey: 'attempt-key-1' });

    respond(500, { error: { code: 'server_error', message: 'Boom' } });
    expect(await place(checkoutFixture('en'))).toEqual({ ok: false, message: 'We could not confirm your order. Please try again.', attemptKey: 'attempt-key-1' });

    http.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await placeOrderAction('ar', { checkout: checkoutFixture('ar'), note: '', acceptTerms: true, attemptKey: 'attempt-key-1', acceptPaymentChange: false })).toEqual({
      ok: false,
      message: 'تعذر تأكيد طلبك. حاول مرة أخرى.',
      attemptKey: 'attempt-key-1',
    });
    expect(http.fetch).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });

  it('gives a key of its own when the browser sends none worth using', async () => {
    respond(200, done());
    await place(checkoutFixture('en'), { attemptKey: 'x y' });
    expect(request().headers['Idempotency-Key']).toMatch(UUID);
  });
});

describe('computeCheckoutAction', () => {
  it('sends the choices (only the ones the contract knows) and returns the API checkout', async () => {
    const checkout = checkoutFixture('en');
    respond(200, { data: checkout });
    const selections = { fulfilment: 'pickup', branchId: 71, addressId: '501', paymentMethodId: 1.5, promoCode: '  SAVE10 ', note: '', prescriptionFiles: ['up-1', 7], expectedTotal: 1, acceptPaymentChange: 'yes' };

    const result = await computeCheckoutAction('en', selections as never);

    expect(result).toEqual({ ok: true, checkout });
    expect(request().url).toBe('https://api.test/api/customer/v3/checkout');
    expect(request().body).toEqual({
      fulfilment: 'pickup',
      addressId: null,
      branchId: 71,
      paymentMethodId: null,
      installmentPlanId: null,
      promoCode: 'SAVE10',
      note: null,
      prescriptionFiles: ['up-1'],
    });
  });

  it('phase B: passes the wallet switch on only as a real true', async () => {
    respond(200, { data: checkoutFixture('en') });
    await computeCheckoutAction('en', { useWallet: true } as never);
    expect(request().body).toMatchObject({ useWallet: true });

    respond(200, { data: checkoutFixture('en') });
    await computeCheckoutAction('en', { useWallet: 'yes' } as never);
    expect(request().body).not.toHaveProperty('useWallet');
  });

  it('passes the backend message on, and uses localized text for session and network problems', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(422, { error: { code: 'validation_failed', message: 'Invalid', fields: { promoCode: ['The promo code is too long.'] } } });
    expect(await computeCheckoutAction('en', {})).toEqual({ ok: false, message: 'The promo code is too long.' });

    respond(401, { error: { code: 'unauthenticated', message: 'Please start a session first.' } });
    expect(await computeCheckoutAction('en', {})).toEqual({ ok: false, message: 'Your session has expired. Reload the page and try again.' });

    respond(500, { error: { code: 'server_error', message: 'Boom' } });
    expect(await computeCheckoutAction('ar', {})).toEqual({ ok: false, message: 'تعذر تحديث طلبك. حاول مرة أخرى.' });

    vi.mocked(shopperContext).mockResolvedValue({ locale: 'en', token: null });
    expect(await computeCheckoutAction('en', {})).toEqual({ ok: false, message: 'Your session has expired. Reload the page and try again.' });
    expect(http.fetch).toHaveBeenCalledTimes(3);
    log.mockRestore();
  });
});

describe('saveContactAction', () => {
  it('saves the contact, then computes the checkout again for the same choices', async () => {
    const checkout = checkoutFixture('en');
    respond(200, { data: { isGuest: true, name: 'Mona Ali', phone: '01234567890', email: null } });
    respond(200, { data: checkout });

    const result = await saveContactAction('en', { firstName: ' Mona ', lastName: 'Ali', phone: '01234567890', email: '' }, { fulfilment: 'pickup', branchId: 72 });

    expect(result).toEqual({ ok: true, checkout });
    expect(request(0)).toMatchObject({ url: 'https://api.test/api/customer/v3/checkout/contact', method: 'PUT', body: { firstName: 'Mona', lastName: 'Ali', phone: '01234567890', email: null } });
    expect(request(1)).toMatchObject({ url: 'https://api.test/api/customer/v3/checkout', body: { fulfilment: 'pickup', branchId: 72 } });
  });

  it('returns the backend field messages', async () => {
    respond(422, { error: { code: 'validation_failed', message: 'Please check the highlighted fields.', fields: { phone: ['Enter a valid phone number.'], firstName: ['This field is required.'] } } });
    expect(await saveContactAction('en', { firstName: '', lastName: 'Ali', phone: '12' }, {})).toEqual({
      ok: false,
      fieldErrors: { phone: 'Enter a valid phone number.', firstName: 'This field is required.' },
    });
    expect(http.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns the backend message when the phone belongs to an account', async () => {
    respond(409, { error: { code: 'phone_in_use', message: 'This phone number belongs to an account. Sign in to continue.' } });
    expect(await saveContactAction('en', { firstName: 'Mona', lastName: 'Ali', phone: '01000000001' }, {})).toEqual({
      ok: false,
      message: 'This phone number belongs to an account. Sign in to continue.',
    });
  });
});

describe('uploadPrescriptionAction', () => {
  const form = (file?: File) => {
    const data = new FormData();
    if (file) data.set('file', file);
    return data;
  };

  it('uploads the file and returns what the backend stored', async () => {
    respond(201, { data: { id: 'up-1', name: 'rx.jpg' } });

    const result = await uploadPrescriptionAction('en', form(new File(['data'], 'rx.jpg', { type: 'image/jpeg' })));

    expect(result).toEqual({ ok: true, file: { id: 'up-1', name: 'rx.jpg' } });
    const sent = request();
    expect(sent.url).toBe('https://api.test/api/customer/v3/uploads');
    expect(((sent.body as FormData).get('file') as File).name).toBe('rx.jpg');
  });

  it('shows the backend message for a refused file and a localized one for anything else', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    respond(422, { error: { code: 'validation_failed', message: 'Invalid', fields: { file: ['Upload a jpg, png, webp or pdf file.'] } } });
    expect(await uploadPrescriptionAction('en', form(new File(['x'], 'notes.txt')))).toEqual({ ok: false, message: 'Upload a jpg, png, webp or pdf file.' });

    expect(await uploadPrescriptionAction('ar', form())).toEqual({ ok: false, message: 'تعذر رفع الملف. حاول مرة أخرى.' });

    http.fetch.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await uploadPrescriptionAction('en', form(new File(['x'], 'rx.png')))).toEqual({ ok: false, message: 'We could not upload the file. Please try again.' });
    log.mockRestore();
  });
});
