/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Cart } from '@/sdk';
import { cartFixture, emptyCartFixture } from '@/test/fixtures';
import { CartEmpty } from './CartEmpty';
import { CartView } from './CartView';
import type { CartActionResult } from './types';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** What the API answers after the second line goes to 2. The totals are the API's, never ours. */
function cartAfterIncrease(): Cart {
  const cart = cartFixture('en');
  cart.items[1] = { ...cart.items[1], quantity: 2, lineTotal: { amount: 320, currency: 'EGP' } };
  cart.summary = { ...cart.summary, itemCount: 4, subtotal: { amount: 356, currency: 'EGP' }, total: { amount: 356, currency: 'EGP' } };
  cart.checkout = { ...cart.checkout, allowed: true, blockers: [] };
  return cart;
}

function setup(cart: Cart = cartFixture('en'), locale: 'en' | 'ar' = 'en') {
  const actions = {
    setQuantityAction: vi.fn<(locale: 'en' | 'ar', productId: number, quantity: number) => Promise<CartActionResult>>(),
    removeItemAction: vi.fn<(locale: 'en' | 'ar', productId: number) => Promise<CartActionResult>>(),
    clearCartAction: vi.fn<(locale: 'en' | 'ar') => Promise<CartActionResult>>(),
  };
  const view = render(<CartView cart={cart} locale={locale} {...actions} />);
  return { ...actions, ...view, user: userEvent.setup() };
}

describe('CartView', () => {
  it('renders every line and the summary from the API (en)', () => {
    setup();
    const lines = screen.getAllByTestId('cart-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveTextContent('J&J Baby Bedtime Bath 125Ml Lavender&Camomile');
    expect(lines[1]).toHaveTextContent('EGP 160');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 196');
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: 'Your items' })).toBeVisible();
  });

  it('renders in Arabic', () => {
    setup(cartFixture('ar'), 'ar');
    expect(screen.getAllByTestId('cart-line')).toHaveLength(2);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('١٩٦ ج.م');
    expect(screen.getByRole('button', { name: 'إفراغ السلة' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled();
  });

  it('shows the new quantity at once but waits for the API for every total', async () => {
    const { user, setQuantityAction } = setup();
    const answer = deferred<CartActionResult>();
    setQuantityAction.mockReturnValue(answer.promise);

    const second = screen.getAllByTestId('cart-line')[1];
    await user.click(within(second).getByRole('button', { name: 'Increase quantity' }));

    expect(setQuantityAction).toHaveBeenCalledWith('en', 7346, 2);
    expect(within(second).getByTestId('cart-quantity')).toHaveTextContent('2');
    expect(second).toHaveAttribute('aria-busy', 'true');
    // still the last API answer while the request is on its way
    expect(within(second).getByTestId('cart-line-total')).toHaveTextContent('EGP 160');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 196');
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();

    answer.resolve({ ok: true, cart: cartAfterIncrease() });

    await waitFor(() => expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 356'));
    expect(within(screen.getAllByTestId('cart-line')[1]).getByTestId('cart-line-total')).toHaveTextContent('EGP 320');
    expect(screen.queryByTestId('checkout-blockers')).toBeNull();
    expect(screen.getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');
  });

  it('goes back to the API quantity and shows the message when the update fails', async () => {
    const { user, setQuantityAction } = setup();
    setQuantityAction.mockResolvedValue({ ok: false, message: 'This quantity is not allowed.' });

    const first = screen.getAllByTestId('cart-line')[0];
    await user.click(within(first).getByRole('button', { name: 'Increase quantity' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('This quantity is not allowed.');
    expect(within(first).getByTestId('cart-quantity')).toHaveTextContent('2');
    expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 196');
  });

  it('removes a line with the cart the API returns', async () => {
    const { user, removeItemAction } = setup();
    const after = cartFixture('en');
    after.items = [after.items[1]];
    after.summary = { itemCount: 1, subtotal: { amount: 160, currency: 'EGP' }, discount: null, total: { amount: 160, currency: 'EGP' } };
    removeItemAction.mockResolvedValue({ ok: true, cart: after });

    await user.click(within(screen.getAllByTestId('cart-line')[0]).getByRole('button', { name: 'Remove' }));

    expect(removeItemAction).toHaveBeenCalledWith('en', 36480);
    await waitFor(() => expect(screen.getAllByTestId('cart-line')).toHaveLength(1));
    expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 160');
  });

  it('clears the cart after confirmation and shows the empty state', async () => {
    const { user, clearCartAction } = setup();
    clearCartAction.mockResolvedValue({ ok: true, cart: emptyCartFixture('en') });

    await user.click(screen.getByRole('button', { name: 'Clear cart' }));
    await user.click(screen.getByRole('button', { name: 'Keep items' }));
    expect(clearCartAction).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Clear cart' }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    expect(clearCartAction).toHaveBeenCalledWith('en');
    expect(await screen.findByTestId('cart-empty')).toBeVisible();
    expect(screen.queryByTestId('cart-line')).toBeNull();
  });

  it('shows a generic message when the server action itself fails', async () => {
    const { user, removeItemAction } = setup(cartFixture('ar'), 'ar');
    removeItemAction.mockRejectedValue(new Error('offline'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    await user.click(within(screen.getAllByTestId('cart-line')[0]).getByRole('button', { name: 'حذف' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر تحديث السلة. حاول مرة أخرى.');
    expect(screen.getAllByTestId('cart-line')).toHaveLength(2);
    log.mockRestore();
  });

  it('follows a fresh server render', () => {
    const { rerender, setQuantityAction, removeItemAction, clearCartAction } = setup();
    rerender(<CartView cart={cartAfterIncrease()} locale="en" setQuantityAction={setQuantityAction} removeItemAction={removeItemAction} clearCartAction={clearCartAction} />);
    expect(screen.getByTestId('cart-total')).toHaveTextContent('EGP 356');
  });
});

describe('CartEmpty', () => {
  it('links back to the store (en)', () => {
    render(<CartEmpty locale="en" />);
    const empty = screen.getByTestId('cart-empty');
    expect(within(empty).getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
    expect(within(empty).getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/en');
  });

  it('links back to the store (ar)', () => {
    render(<CartEmpty locale="ar" />);
    const empty = screen.getByTestId('cart-empty');
    expect(within(empty).getByRole('heading', { name: 'سلة التسوق فارغة' })).toBeVisible();
    expect(within(empty).getByRole('link', { name: 'متابعة التسوق' })).toHaveAttribute('href', '/ar');
  });

  it('is what an emptied cart from the API renders', () => {
    setup(emptyCartFixture('en'));
    expect(screen.getByTestId('cart-empty')).toBeVisible();
    expect(screen.queryByTestId('cart-summary')).toBeNull();
  });
});
