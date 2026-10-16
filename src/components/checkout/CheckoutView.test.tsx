/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { checkoutSelections, type Checkout, type CheckoutSettings, type Locale } from '@/sdk';
import {
  checkoutFixture,
  checkoutSettingsFixture,
  firstCheckoutFixture,
  guestCheckoutFixture,
  pickupBranchesFixture,
  pickupCheckoutFixture,
} from '@/test/checkout-fixtures';
import { CheckoutView } from './CheckoutView';
import type { ComputeCheckoutAction, ComputeResult, PlaceOrderAction, PlaceOrderOutcome, SaveContactAction, UploadPrescriptionAction } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** A checkout "from the API" with texts no storefront code would produce. */
function answer(change: (checkout: Checkout) => void, base: Checkout = checkoutFixture('en')): Checkout {
  const checkout = structuredClone(base);
  change(checkout);
  return checkout;
}

const withTotal = (display: string, amount: number, base?: Checkout) =>
  answer((checkout) => {
    checkout.totals.total = { amount, currency: 'EGP', display };
  }, base);

function setup(checkout: Checkout = checkoutFixture('en'), { locale = 'en' as Locale, settings = {} as Partial<CheckoutSettings> } = {}) {
  const actions = {
    computeAction: vi.fn<ComputeCheckoutAction>(),
    saveContactAction: vi.fn<SaveContactAction>(),
    uploadAction: vi.fn<UploadPrescriptionAction>(),
    placeAction: vi.fn<PlaceOrderAction>(),
  };
  const navigate = vi.fn();
  const view = render(
    <CheckoutView
      checkout={checkout}
      settings={checkoutSettingsFixture(settings)}
      branches={pickupBranchesFixture(locale)}
      locale={locale}
      attemptKey="attempt-key-1"
      navigate={navigate}
      {...actions}
    />,
  );
  return { ...actions, ...view, navigate, user: userEvent.setup() };
}

const placeButton = () => screen.getByTestId('place-order');
const terms = () => screen.getByTestId('checkout-terms');
const radio = (testId: string, index = 0) => within(screen.getAllByTestId(testId)[index]).getByRole('radio');

describe('CheckoutView: drawing the API answer', () => {
  it('shows contact, options, fees, lines and the total as the API sent them (en)', () => {
    const checkout = checkoutFixture('en');
    setup(checkout);

    expect(screen.getByTestId('checkout-store-notice')).toHaveTextContent('Orders placed before 6 pm are delivered the same day.');
    expect(screen.getByTestId('checkout-contact-details')).toHaveTextContent('Test Customer');
    expect(radio('fulfilment-delivery')).toBeChecked();
    expect(radio('fulfilment-pickup')).not.toBeChecked();
    expect(screen.getByTestId('checkout-address')).toHaveTextContent(checkout.fulfilment.addresses[0].formatted);
    expect(radio('checkout-address')).toBeChecked();
    expect(screen.getByTestId('checkout-delivery')).toHaveTextContent(checkout.fulfilment.delivery!.fee!.display);

    const methods = screen.getAllByTestId('payment-method');
    expect(methods).toHaveLength(4);
    expect(within(methods[0]).getByRole('radio')).toBeChecked();
    expect(within(methods[1]).getByTestId('payment-fee')).toHaveTextContent(checkout.payment.methods[1].fee!.display);
    expect(methods[1]).toHaveTextContent('The courier brings a card machine.');
    expect(methods[2]).toHaveTextContent('You pay on a secure payment page after you place the order.');

    const lines = screen.getAllByTestId('checkout-total-line');
    expect(lines.map((line) => line.textContent)).toEqual(checkout.totals.lines.map((line) => `${line.label}${line.amount!.display}`));
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);
    expect(screen.getAllByTestId('checkout-item')).toHaveLength(2);
    expect(screen.getAllByTestId('checkout-item-total')[1].textContent).toBe(checkout.cart.items[1].lineTotal.display);
    expect(screen.queryByTestId('checkout-missing')).toBeNull();
    expect(screen.queryByTestId('checkout-blockers')).toBeNull();
    expect(screen.queryByTestId('checkout-prescription')).toBeNull();
  });

  it('renders in Arabic with the API texts', () => {
    const checkout = checkoutFixture('ar');
    setup(checkout, { locale: 'ar' });

    expect(screen.getByRole('heading', { name: 'ملخص الطلب' })).toBeVisible();
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);
    expect(screen.getByTestId('fulfilment-delivery')).toHaveTextContent(checkout.fulfilment.options[0].label);
    expect(placeButton()).toHaveTextContent('تأكيد الطلب');
    expect(screen.getByLabelText('أوافق على الشروط والأحكام.')).not.toBeChecked();
  });

  it('shows what is missing and what blocks the order in the backend words, and keeps the button off', async () => {
    const checkout = firstCheckoutFixture('en');
    const { user } = setup(checkout);

    expect(screen.getByTestId('checkout-missing')).toHaveTextContent(checkout.missing[0].message);
    expect(screen.getByTestId('checkout-blockers')).toHaveTextContent(checkout.blockers[0].message);
    expect(screen.getByTestId('cart-minimum-remaining').textContent).toBe(checkout.minimumOrder!.remaining.display);
    expect(screen.getAllByTestId('payment-method').every((method) => !within(method).getByRole<HTMLInputElement>('radio').checked)).toBe(true);

    await user.click(terms());
    expect(placeButton()).toBeDisabled();
  });

  describe('the minimum order', () => {
    /** A store whose minimum counts delivery: no checkout verdict before the address / branch (seif). */
    const noVerdictYet = (locale: Locale = 'en') =>
      answer((c) => {
        c.fulfilment.selected = null;
        c.fulfilment.addressId = null;
        c.fulfilment.delivery = null;
        c.missing = [{ code: 'fulfilment', message: 'MISSING-FULFILMENT' }];
        c.blockers = [];
        c.canPlaceOrder = false;
        c.minimumOrder = { amount: { amount: 50, currency: 'EGP', display: 'MIN-AMOUNT' }, remaining: { amount: 14, currency: 'EGP', display: 'CHECKOUT-REMAINING' }, progressPercent: 72 };
        c.cart.checkout = {
          allowed: false,
          blockers: [{ code: 'minimum_order', message: 'CART-MINIMUM-TEXT' }],
          minimumOrder: { amount: { amount: 50, currency: 'EGP', display: 'MIN-AMOUNT' }, remaining: { amount: 14, currency: 'EGP', display: 'CART-REMAINING' }, progressPercent: 72 },
        };
      }, checkoutFixture(locale));

    it('before the address or branch is chosen, shows the cart verdict, never "reached"', () => {
      setup(noVerdictYet());
      expect(screen.getByTestId('cart-minimum-remaining').textContent).toBe('CART-REMAINING');
      expect(screen.queryByText('Minimum order reached')).toBeNull();
    });

    it('the same in Arabic', () => {
      setup(noVerdictYet('ar'), { locale: 'ar' });
      expect(screen.getByTestId('cart-minimum-remaining').textContent).toBe('CART-REMAINING');
    });

    it('the checkout blocker wins, with the checkout numbers', () => {
      const checkout = answer((c) => {
        c.missing = [];
        c.blockers = [{ code: 'minimum_order', message: 'CHECKOUT-MINIMUM-TEXT' }];
      }, noVerdictYet());
      setup(checkout);
      expect(screen.getByTestId('cart-minimum-remaining').textContent).toBe('CHECKOUT-REMAINING');
      expect(screen.getByTestId('checkout-blockers')).toHaveTextContent('CHECKOUT-MINIMUM-TEXT');
    });

    it('reached once the backend has a verdict without the blocker', () => {
      const checkout = answer((c) => {
        c.missing = [{ code: 'payment_method', message: 'MISSING-PAYMENT' }];
      }, noVerdictYet());
      setup(checkout);
      expect(screen.queryByTestId('cart-minimum-remaining')).toBeNull();
      expect(screen.getByTestId('cart-minimum-order')).toHaveTextContent('Minimum order reached');
    });

    it('reached before the choice when the cart has no minimum blocker either', () => {
      const checkout = answer((c) => {
        c.cart.checkout.blockers = [];
      }, noVerdictYet());
      setup(checkout);
      expect(screen.queryByTestId('cart-minimum-remaining')).toBeNull();
    });
  });

  it('draws values it does not know the default way', () => {
    const checkout = answer((c) => {
      c.totals.lines.push({ kind: 'loyalty' as never, label: 'Points used', amount: null, text: 'POINTS-TEXT' });
      c.missing.push({ code: 'something_new', message: 'Do the new thing.' });
      c.messages.push({ level: 'notice' as never, text: 'A new kind of message.' });
    });
    setup(checkout);

    expect(screen.getAllByTestId('checkout-total-line').at(-1)).toHaveTextContent('Points usedPOINTS-TEXT');
    expect(screen.getByTestId('checkout-missing')).toHaveTextContent('Do the new thing.');
    expect(screen.getByTestId('checkout-messages')).toHaveTextContent('A new kind of message.');
  });

  it('shows the text the backend sends instead of an amount', () => {
    const checkout = pickupCheckoutFixture('en');
    setup(checkout);

    expect(radio('fulfilment-pickup')).toBeChecked();
    expect(screen.getAllByTestId('checkout-branch')).toHaveLength(2);
    expect(radio('checkout-branch')).toBeChecked();
    expect(screen.getByTestId('checkout-delivery')).toHaveTextContent(checkout.fulfilment.delivery!.text!);
    const texts = screen.getAllByTestId('checkout-total-line').map((line) => line.textContent);
    expect(texts).toContain(`Promo code SAVE10${checkout.totals.lines[1].amount!.display}`);
    expect(texts).toContain(`Delivery${checkout.totals.lines[2].text}`);
    expect(screen.queryByTestId('checkout-address')).toBeNull();
    // installments are chosen, a plan is not: the backend says so and lists the plans
    expect(screen.getAllByTestId('payment-plan')).toHaveLength(2);
    expect(screen.getByTestId('checkout-missing')).toHaveTextContent(checkout.missing[0].message);
    expect(screen.getByTestId('promo-code')).toHaveTextContent('SAVE10');
    expect(screen.getByTestId('promo-message')).toHaveTextContent(checkout.promo.message!);
  });

  it('marks an address the store does not deliver to and offers the addresses page for a new one', () => {
    const checkout = answer((c) => {
      c.fulfilment.addresses.push({ ...c.fulfilment.addresses[0], id: 777, isDefault: false, formatted: 'Desert Rd, Remote Oasis', deliverable: false });
    });
    setup(checkout);

    const remote = screen.getAllByTestId('checkout-address')[1];
    expect(within(remote).getByRole('radio')).toBeDisabled();
    expect(remote).toHaveTextContent('We do not deliver to this address right now.');
    expect(screen.getByTestId('checkout-add-address')).toHaveAttribute('href', '/en/account/address?next=checkout');
  });

  it('hides the promo field and the note when the store settings switch them off', () => {
    setup(checkoutFixture('en'), { settings: { promoCode: false, orderNote: false, notice: null } });
    expect(screen.queryByTestId('checkout-promo')).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Order note' })).toBeNull();
    expect(screen.queryByTestId('checkout-store-notice')).toBeNull();
  });
});

describe('CheckoutView: changing a choice', () => {
  it('asks the backend with the echoed choices plus the change, and shows no total until it answers', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    const pending = deferred<ComputeResult>();
    computeAction.mockReturnValue(pending.promise);

    await user.click(radio('fulfilment-pickup'));

    expect(computeAction).toHaveBeenCalledWith('en', { ...checkoutSelections(checkout), note: null, fulfilment: 'pickup' });
    // the choice is marked at once...
    expect(radio('fulfilment-pickup')).toBeChecked();
    expect(screen.getAllByTestId('checkout-branch')).toHaveLength(2);
    // ...but no price that was computed for the old choice stays on screen
    expect(screen.queryByTestId('checkout-total')).toBeNull();
    expect(screen.queryByTestId('checkout-totals')).toBeNull();
    expect(screen.queryByTestId('checkout-delivery')).toBeNull();
    expect(screen.queryByTestId('payment-fee')).toBeNull();
    expect(screen.queryByTestId('checkout-item-total')).toBeNull();
    expect(screen.getByTestId('checkout-updating')).toHaveTextContent('Updating your order…');
    expect(screen.getByTestId('checkout')).toHaveAttribute('aria-busy', 'true');
    await user.click(terms());
    expect(placeButton()).toBeDisabled();

    pending.resolve({ ok: true, checkout: withTotal('TOTAL-AFTER-PICKUP', 320.4, pickupCheckoutFixture('en')) });

    await waitFor(() => expect(screen.getByTestId('checkout-total').textContent).toBe('TOTAL-AFTER-PICKUP'));
    expect(radio('fulfilment-pickup')).toBeChecked();
    expect(screen.queryByTestId('checkout-updating')).toBeNull();
  });

  it('runs changes in order, each on top of the previous answer', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    const first = deferred<ComputeResult>();
    const second = deferred<ComputeResult>();
    computeAction.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    await user.click(radio('payment-method', 1));
    await user.click(radio('fulfilment-pickup'));

    // the second change waits for the first answer
    expect(computeAction).toHaveBeenCalledTimes(1);
    expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ paymentMethodId: 2, installmentPlanId: null, fulfilment: 'delivery' }));

    const afterFirst = answer((c) => {
      c.payment.selected = { methodId: 2, planId: null };
      c.totals.total = { amount: 391, currency: 'EGP', display: 'TOTAL-WITH-FEE' };
    });
    first.resolve({ ok: true, checkout: afterFirst });

    await waitFor(() => expect(computeAction).toHaveBeenCalledTimes(2));
    expect(computeAction).toHaveBeenLastCalledWith('en', { ...checkoutSelections(afterFirst), note: null, fulfilment: 'pickup' });
    // still computing: the total of the first answer is not shown next to the second choice
    expect(screen.queryByTestId('checkout-total')).toBeNull();

    second.resolve({ ok: true, checkout: withTotal('TOTAL-FINAL', 366, pickupCheckoutFixture('en')) });
    await waitFor(() => expect(screen.getByTestId('checkout-total').textContent).toBe('TOTAL-FINAL'));
  });

  it('shows the choice the backend answered, not the one that was clicked, when they differ', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    // the backend dropped the payment method and says why
    computeAction.mockResolvedValue({
      ok: true,
      checkout: answer((c) => {
        c.payment.selected = null;
        c.messages = [{ level: 'warning', text: 'That payment method is not available any more.' }];
        c.missing = [{ code: 'payment_method', message: 'Choose a payment method.' }];
        c.canPlaceOrder = false;
      }),
    });

    await user.click(radio('payment-method', 2));

    await waitFor(() => expect(screen.getByTestId('checkout-messages')).toHaveTextContent('That payment method is not available any more.'));
    expect(radio('payment-method', 2)).not.toBeChecked();
    expect(screen.getByTestId('checkout-missing')).toHaveTextContent('Choose a payment method.');
    expect(screen.getByTestId('checkout-messages').firstElementChild).toHaveAttribute('data-level', 'warning');
  });

  it('goes back to the last API answer and shows the message when the backend can not be asked', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    computeAction.mockResolvedValue({ ok: false, message: 'We could not update your order. Please try again.' });

    await user.click(radio('fulfilment-pickup'));

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not update your order. Please try again.');
    expect(radio('fulfilment-delivery')).toBeChecked();
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);
  });

  it('picking a method, a plan, an address and a branch each only tell the backend', async () => {
    const checkout = pickupCheckoutFixture('en');
    const { user, computeAction } = setup(checkout);
    computeAction.mockResolvedValue({ ok: true, checkout });

    await user.click(radio('payment-plan', 1));
    await waitFor(() => expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ paymentMethodId: 4, installmentPlanId: 42 })));

    await user.click(radio('checkout-branch', 1));
    await waitFor(() => expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ fulfilment: 'pickup', branchId: 72 })));

    await user.click(radio('payment-method', 0));
    await waitFor(() => expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ paymentMethodId: 1, installmentPlanId: null })));
  });

  it('a refused promo code shows the backend message, is not kept, and does not block the order', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    const refused = answer((c) => {
      c.promo = { code: 'NOPE', applied: false, message: 'PROMO-REFUSED-TEXT' };
      c.blockers = [{ code: 'promo_invalid', message: 'Remove the promo code or enter a valid one.' }];
      c.canPlaceOrder = false;
    });
    computeAction.mockResolvedValueOnce({ ok: true, checkout: refused }).mockResolvedValueOnce({ ok: true, checkout });

    await user.type(screen.getByRole('textbox', { name: 'Promo code' }), ' NOPE ');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByTestId('promo-message')).toHaveTextContent('PROMO-REFUSED-TEXT');
    // asked with the code, then again without it, on top of the refused answer's choices
    expect(computeAction).toHaveBeenCalledTimes(2);
    expect(computeAction.mock.calls[0][1]).toMatchObject({ promoCode: 'NOPE' });
    expect(computeAction.mock.calls[1][1]).toMatchObject({ ...checkoutSelections(refused), promoCode: null });
    const message = screen.getByTestId('promo-message');
    expect(message).toHaveAttribute('data-applied', 'false');
    expect(message).toHaveAttribute('role', 'alert');
    // not applied: the field (with the typed code) instead of a "Remove code" button
    const field = screen.getByRole('textbox', { name: 'Promo code' });
    expect(field).toHaveValue(' NOPE ');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', message.id);
    expect(screen.queryByRole('button', { name: 'Remove code' })).toBeNull();
    expect(screen.queryByTestId('checkout-blockers')).toBeNull();
    await user.click(terms());
    expect(placeButton()).toBeEnabled();

    // a valid code afterwards: the refusal is gone and the backend's own message shows
    const applied = answer((c) => {
      c.promo = { code: 'SAVE10', applied: true, message: 'PROMO-APPLIED-TEXT' };
    });
    computeAction.mockResolvedValueOnce({ ok: true, checkout: applied });
    await user.clear(field);
    await user.type(field, 'SAVE10');
    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(await screen.findByTestId('promo-code')).toHaveTextContent('SAVE10');
    expect(screen.getByTestId('promo-message')).toHaveTextContent('PROMO-APPLIED-TEXT');
    expect(screen.getByTestId('promo-message')).toHaveAttribute('role', 'status');
    expect(computeAction).toHaveBeenCalledTimes(3);
  });

  it('removing an applied code sends null and is asked only once', async () => {
    const checkout = answer((c) => {
      c.promo = { code: 'SAVE10', applied: true, message: 'PROMO-APPLIED-TEXT' };
    });
    const { user, computeAction } = setup(checkout);
    computeAction.mockResolvedValueOnce({ ok: true, checkout: checkoutFixture('en') });

    await user.click(screen.getByRole('button', { name: 'Remove code' }));
    await waitFor(() => expect(screen.queryByTestId('promo-message')).toBeNull());
    expect(computeAction).toHaveBeenCalledTimes(1);
    expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ promoCode: null }));
  });

  it('keeps a refused code on screen (with "Remove code") when asking again without it fails', async () => {
    const { user, computeAction } = setup(checkoutFixture('en'));
    const refused = answer((c) => {
      c.promo = { code: 'NOPE', applied: false, message: 'PROMO-REFUSED-TEXT' };
      c.blockers = [{ code: 'promo_invalid', message: 'PROMO-BLOCKER-TEXT' }];
      c.canPlaceOrder = false;
    });
    computeAction.mockResolvedValueOnce({ ok: true, checkout: refused }).mockResolvedValueOnce({ ok: false, message: 'ACTION-FAILED' });

    await user.type(screen.getByRole('textbox', { name: 'Promo code' }), 'NOPE');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    expect(await screen.findByTestId('promo-code')).toHaveTextContent('NOPE');
    expect(screen.getByRole('button', { name: 'Remove code' })).toBeVisible();
    expect(screen.getByTestId('checkout-blockers')).toHaveTextContent('PROMO-BLOCKER-TEXT');
  });

  it('a refused code in Arabic: the backend message and the Arabic field', async () => {
    const checkout = checkoutFixture('ar');
    const { user, computeAction } = setup(checkout, { locale: 'ar' });
    const refused = answer((c) => {
      c.promo = { code: 'NOPE', applied: false, message: 'نص-رفض-الكود' };
      c.blockers = [{ code: 'promo_invalid', message: 'نص-المانع' }];
      c.canPlaceOrder = false;
    }, checkout);
    computeAction.mockResolvedValueOnce({ ok: true, checkout: refused }).mockResolvedValueOnce({ ok: true, checkout });

    const field = screen.getByTestId('checkout-promo').querySelector('input[name="promoCode"]') as HTMLInputElement;
    await user.type(field, 'NOPE');
    await user.click(within(screen.getByTestId('checkout-promo')).getByRole('button'));

    expect(await screen.findByTestId('promo-message')).toHaveTextContent('نص-رفض-الكود');
    expect(computeAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('checkout-blockers')).toBeNull();
  });

  it('sends the order note with the choices', async () => {
    const checkout = checkoutFixture('en');
    const { user, computeAction } = setup(checkout);
    computeAction.mockResolvedValue({ ok: true, checkout });

    await user.type(screen.getByRole('textbox', { name: 'Order note' }), 'Ring twice');
    await user.click(radio('payment-method', 1));

    expect(computeAction).toHaveBeenCalledWith('en', expect.objectContaining({ note: 'Ring twice', paymentMethodId: 2 }));
  });
});

describe('CheckoutView: prescription', () => {
  const needsPrescription = () =>
    answer((c) => {
      c.requirements.prescription = { required: true, files: [] };
      c.missing = [{ code: 'prescription', message: 'Upload your prescription.' }];
      c.canPlaceOrder = false;
    });

  it('uploads a file, then asks the backend to compute with it; the list is the backend echo', async () => {
    const before = needsPrescription();
    const { user, uploadAction, computeAction } = setup(before);
    const after = answer((c) => {
      c.requirements.prescription = { required: true, files: [{ id: 'up-1', name: 'rx.jpg' }] };
    });
    uploadAction.mockResolvedValue({ ok: true, file: { id: 'up-1', name: 'rx.jpg' } });
    computeAction.mockResolvedValue({ ok: true, checkout: after });

    await user.upload(screen.getByLabelText(/Upload a file/), new File(['data'], 'rx.jpg', { type: 'image/jpeg' }));

    await waitFor(() => expect(computeAction).toHaveBeenCalledWith('en', expect.objectContaining({ prescriptionFiles: ['up-1'] })));
    expect((uploadAction.mock.calls[0][1].get('file') as File).name).toBe('rx.jpg');
    expect(await screen.findByTestId('prescription-file')).toHaveTextContent('rx.jpg');

    computeAction.mockResolvedValue({ ok: true, checkout: before });
    await user.click(screen.getByRole('button', { name: 'Remove file: rx.jpg' }));
    await waitFor(() => expect(computeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ prescriptionFiles: [] })));
    await waitFor(() => expect(screen.queryByTestId('prescription-file')).toBeNull());
  });

  it('shows the backend message when the upload is refused and does not compute', async () => {
    const { user, uploadAction, computeAction } = setup(needsPrescription());
    uploadAction.mockResolvedValue({ ok: false, message: 'Upload a jpg, png, webp or pdf file.' });

    await user.upload(screen.getByLabelText(/Upload a file/), new File(['data'], 'rx.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Upload a jpg, png, webp or pdf file.');
    expect(computeAction).not.toHaveBeenCalled();
    expect(screen.queryByTestId('prescription-file')).toBeNull();
  });
});

describe('CheckoutView: guests', () => {
  it('saves the contact details through the backend and shows its field messages', async () => {
    const guest = guestCheckoutFixture('en');
    const { user, saveContactAction } = setup(guest);
    const saved = answer((c) => {
      c.contact = { isGuest: true, name: 'Mona Ali', phone: '01234567890', email: null };
      c.missing = c.missing.filter((notice) => notice.code !== 'contact');
    }, guest);
    saveContactAction.mockResolvedValueOnce({ ok: false, fieldErrors: { phone: 'Enter a valid phone number.' } }).mockResolvedValueOnce({ ok: true, checkout: saved });

    const form = screen.getByTestId('checkout-contact-form');
    await user.type(within(form).getByLabelText('First name'), 'Mona');
    await user.type(within(form).getByLabelText('Last name'), 'Ali');
    await user.type(within(form).getByLabelText('Phone number'), '12');
    await user.click(within(form).getByRole('button', { name: 'Save contact details' }));

    expect(saveContactAction).toHaveBeenCalledWith('en', { firstName: 'Mona', lastName: 'Ali', phone: '12', email: null }, { ...checkoutSelections(guest), note: null });
    expect(await within(form).findByText('Enter a valid phone number.')).toBeVisible();
    expect(within(form).getByLabelText('Phone number')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(within(form).getByLabelText('Phone number'));
    await user.type(within(form).getByLabelText('Phone number'), '01234567890');
    await user.click(within(form).getByRole('button', { name: 'Save contact details' }));

    expect(await screen.findByTestId('checkout-contact-details')).toHaveTextContent('Mona Ali');
    expect(screen.queryByTestId('checkout-contact-form')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeVisible();
  });

  it('shows the email field as the store settings say', () => {
    const { unmount } = setup(guestCheckoutFixture('en'), { settings: { guestEmail: 'hidden' } });
    expect(screen.queryByLabelText(/Email/)).toBeNull();
    unmount();

    setup(guestCheckoutFixture('en'), { settings: { guestEmail: 'optional' } });
    expect(screen.getByLabelText(/Email/)).toBeVisible();
    expect(screen.getByText('(optional)')).toBeVisible();
  });

  it('asks the guest to sign in, with a link that comes back to checkout, when the backend wants an account', () => {
    const closed = answer((c) => {
      c.missing = [{ code: 'sign_in', message: 'Sign in to place your order.' }];
      c.blockers = [{ code: 'guest_checkout_disabled', message: 'This store needs an account to place an order.' }];
    }, guestCheckoutFixture('en'));
    setup(closed);

    const prompt = screen.getByTestId('checkout-sign-in');
    expect(prompt).toHaveTextContent('Sign in to place your order.');
    expect(within(prompt).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/en/session/signin?returnUrl=checkout');
    expect(screen.queryByTestId('checkout-contact-form')).toBeNull();
    expect(screen.getByTestId('checkout-blockers')).toHaveTextContent('This store needs an account to place an order.');
  });
});

describe('CheckoutView: placing the order', () => {
  it('is enabled only by canPlaceOrder plus the ticked terms', async () => {
    const { user } = setup(checkoutFixture('en'));
    expect(placeButton()).toBeDisabled();
    await user.click(terms());
    expect(placeButton()).toBeEnabled();
    await user.click(terms());
    expect(placeButton()).toBeDisabled();
  });

  it('sends the checkout on screen as one piece, then leaves for the next page', async () => {
    const checkout = checkoutFixture('en');
    const { user, placeAction, navigate } = setup(checkout);
    placeAction.mockResolvedValue({ ok: true, url: '/en/checkout/final-receipt?checkout=ref-1' });

    await user.type(screen.getByRole('textbox', { name: 'Order note' }), 'Ring twice');
    await user.click(terms());
    await user.click(placeButton());

    expect(placeAction).toHaveBeenCalledTimes(1);
    expect(placeAction).toHaveBeenCalledWith('en', { checkout, note: 'Ring twice', acceptTerms: true, attemptKey: 'attempt-key-1', acceptPaymentChange: false });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/en/checkout/final-receipt?checkout=ref-1'));
    // the browser is leaving: nothing can be clicked twice
    expect(placeButton()).toBeDisabled();
    expect(placeButton()).toHaveTextContent('Placing your order…');
  });

  it('places the newest answer, not the first one', async () => {
    const { user, computeAction, placeAction } = setup(checkoutFixture('en'));
    const newer = answer((c) => {
      c.payment.selected = { methodId: 2, planId: null };
      c.totals.total = { amount: 391, currency: 'EGP', display: 'TOTAL-WITH-FEE' };
    });
    computeAction.mockResolvedValue({ ok: true, checkout: newer });
    placeAction.mockResolvedValue({ ok: true, url: '/en/checkout/final-receipt?checkout=ref-2' });

    await user.click(radio('payment-method', 1));
    await waitFor(() => expect(screen.getByTestId('checkout-total').textContent).toBe('TOTAL-WITH-FEE'));
    await user.click(terms());
    await user.click(placeButton());

    expect(placeAction.mock.calls[0][1].checkout).toEqual(newer);
  });

  it('total changed: shows the fresh checkout and its message, and the shopper must confirm again', async () => {
    const checkout = checkoutFixture('en');
    const { user, placeAction, navigate } = setup(checkout);
    const fresh = withTotal('TOTAL-NEW-401', 401);
    placeAction
      .mockResolvedValueOnce({ ok: false, message: 'Your order total changed to TOTAL-NEW-401. Please review it and confirm again.', checkout: fresh, attemptKey: 'attempt-key-2' })
      .mockResolvedValueOnce({ ok: true, url: '/en/checkout/final-receipt?checkout=ref-3' });

    await user.click(terms());
    await user.click(placeButton());

    const problem = await screen.findByTestId('checkout-problem');
    expect(problem).toHaveTextContent('Your order total changed to TOTAL-NEW-401. Please review it and confirm again.');
    expect(problem).toHaveAttribute('role', 'alert');
    await waitFor(() => expect(problem).toHaveFocus());
    expect(screen.getByTestId('checkout-total').textContent).toBe('TOTAL-NEW-401');
    // nothing was retried, and the old confirmation does not count for the new total
    expect(placeAction).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(terms()).not.toBeChecked();
    expect(placeButton()).toBeDisabled();

    await user.click(terms());
    await user.click(placeButton());

    expect(placeAction).toHaveBeenLastCalledWith('en', { checkout: fresh, note: '', acceptTerms: true, attemptKey: 'attempt-key-2', acceptPaymentChange: false });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/en/checkout/final-receipt?checkout=ref-3'));
  });

  it('checkout incomplete: shows the fresh checkout with what is missing', async () => {
    const { user, placeAction } = setup(checkoutFixture('en'));
    const fresh = answer((c) => {
      c.payment.selected = null;
      c.missing = [{ code: 'payment_method', message: 'Choose a payment method.' }];
      c.canPlaceOrder = false;
    });
    placeAction.mockResolvedValue({ ok: false, message: 'Your order is not ready to be placed yet. Please review it.', checkout: fresh, attemptKey: 'attempt-key-2' });

    await user.click(terms());
    await user.click(placeButton());

    expect(await screen.findByTestId('checkout-problem')).toHaveTextContent('Your order is not ready to be placed yet. Please review it.');
    expect(screen.getByTestId('checkout-missing')).toHaveTextContent('Choose a payment method.');
    await user.click(terms());
    expect(placeButton()).toBeDisabled();
  });

  it('payment change: a clear accept step that resends with acceptPaymentChange and the new total', async () => {
    const card = answer((c) => {
      c.payment.selected = { methodId: 3, planId: null };
    });
    const { user, placeAction, navigate } = setup(card);
    const fresh = answer((c) => {
      c.payment.selected = { methodId: 1, planId: null };
      c.messages = [{ level: 'warning', text: 'Credit / debit card is not available right now. Your order will be paid with Cash on delivery instead.' }];
      c.totals.total = { amount: 381, currency: 'EGP', display: 'TOTAL-CASH' };
    });
    placeAction
      .mockResolvedValueOnce({ ok: false, message: 'The payment method of your order changed. Please accept the change to continue.', checkout: fresh, needsConsent: true, attemptKey: 'attempt-key-2' })
      .mockResolvedValueOnce({ ok: true, url: '/en/checkout/final-receipt?checkout=ref-4' });

    await user.click(terms());
    await user.click(placeButton());

    expect(await screen.findByTestId('checkout-problem')).toHaveTextContent('The payment method of your order changed. Please accept the change to continue.');
    expect(screen.getByTestId('checkout-messages')).toHaveTextContent('Your order will be paid with Cash on delivery instead.');
    expect(radio('payment-method', 0)).toBeChecked();
    expect(screen.getByTestId('checkout-total').textContent).toBe('TOTAL-CASH');
    expect(placeButton()).toHaveTextContent('Accept and place order');
    expect(placeButton()).toBeDisabled();
    expect(placeAction).toHaveBeenCalledTimes(1);

    await user.click(terms());
    await user.click(placeButton());

    expect(placeAction).toHaveBeenLastCalledWith('en', { checkout: fresh, note: '', acceptTerms: true, attemptKey: 'attempt-key-2', acceptPaymentChange: true });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/en/checkout/final-receipt?checkout=ref-4'));
  });

  it('payment change: choosing something else instead is a normal order again', async () => {
    const { user, placeAction, computeAction } = setup(checkoutFixture('en'));
    const fresh = checkoutFixture('en');
    const chosen = answer((c) => {
      c.payment.selected = { methodId: 2, planId: null };
    });
    placeAction.mockResolvedValueOnce({ ok: false, message: 'Please accept the change.', checkout: fresh, needsConsent: true, attemptKey: 'attempt-key-2' }).mockResolvedValueOnce({ ok: true, url: '/x' });
    computeAction.mockResolvedValue({ ok: true, checkout: chosen });

    await user.click(terms());
    await user.click(placeButton());
    await waitFor(() => expect(placeButton()).toHaveTextContent('Accept and place order'));

    await user.click(radio('payment-method', 1));
    await waitFor(() => expect(placeButton()).toHaveTextContent('Place order'));
    expect(screen.queryByTestId('checkout-problem')).toBeNull();
    await user.click(terms());
    await user.click(placeButton());

    expect(placeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ checkout: chosen, acceptPaymentChange: false }));
  });

  it.each([
    ['order_in_progress', 'We are already placing an order for you. Please wait a moment.', 'attempt-key-1'],
    ['payment_provider_error', 'The payment provider did not answer. Please try again or choose another payment method.', 'attempt-key-9'],
  ])('%s: shows the message, stays on the page and never retries by itself', async (_kind, message, nextKey) => {
    const checkout = checkoutFixture('en');
    const { user, placeAction, navigate } = setup(checkout);
    placeAction.mockResolvedValueOnce({ ok: false, message, attemptKey: nextKey }).mockResolvedValueOnce({ ok: true, url: '/en/checkout/final-receipt?checkout=ref-5' });

    await user.click(terms());
    await user.click(placeButton());

    expect(await screen.findByTestId('checkout-problem')).toHaveTextContent(message);
    expect(placeAction).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('checkout-total').textContent).toBe(checkout.totals.total.display);

    // the shopper tries again: same checkout, and the key the server gave for the next click
    await user.click(placeButton());
    expect(placeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ checkout, attemptKey: nextKey }));
  });

  it('keeps the same attempt key when the action itself fails (outcome unknown)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, placeAction } = setup(checkoutFixture('en'));
    placeAction.mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce({ ok: true, url: '/x' });

    await user.click(terms());
    await user.click(placeButton());
    expect(await screen.findByTestId('checkout-problem')).toHaveTextContent('We could not confirm your order. Please try again.');

    await user.click(placeButton());
    expect(placeAction).toHaveBeenLastCalledWith('en', expect.objectContaining({ attemptKey: 'attempt-key-1' }));
    log.mockRestore();
  });

  it('can not be clicked while a change is being computed, and a second click does not place twice', async () => {
    const { user, computeAction, placeAction } = setup(checkoutFixture('en'));
    const pending = deferred<ComputeResult>();
    computeAction.mockReturnValue(pending.promise);
    const placing = deferred<PlaceOrderOutcome>();
    placeAction.mockReturnValue(placing.promise);

    await user.click(terms());
    await user.click(radio('payment-method', 1));
    await user.click(placeButton());
    expect(placeAction).not.toHaveBeenCalled();

    pending.resolve({ ok: true, checkout: checkoutFixture('en') });
    await waitFor(() => expect(placeButton()).toBeEnabled());
    await user.dblClick(placeButton());
    expect(placeAction).toHaveBeenCalledTimes(1);
  });

  it('shows the empty cart when the fresh checkout has no items left', async () => {
    const { user, placeAction } = setup(checkoutFixture('en'));
    const empty = answer((c) => {
      c.cart.items = [];
      c.canPlaceOrder = false;
    });
    placeAction.mockResolvedValue({ ok: false, message: 'Your cart is empty.', checkout: empty, attemptKey: 'k-2' });

    await user.click(terms());
    await user.click(placeButton());

    expect(await screen.findByTestId('cart-empty')).toBeVisible();
    expect(screen.queryByTestId('place-order')).toBeNull();
  });
});
