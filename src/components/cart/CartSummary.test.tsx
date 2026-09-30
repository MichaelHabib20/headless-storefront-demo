/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cart, Money } from '@/sdk';
import { cartFixture } from '@/test/fixtures';
import { CartSummary } from './CartSummary';

const money = (amount: number, display: string): Money => ({ amount, currency: 'EGP', display });

/**
 * A copy of the real cart where checkout is allowed. The numbers are deliberately NOT
 * consistent with each other (subtotal - discount ≠ total) and the texts are odd: the summary
 * must show the API's text, not what it would compute or format.
 */
function checkoutReadyCart(): Cart {
  const cart = cartFixture('en');
  cart.summary = {
    itemCount: 4,
    subtotal: money(512, 'SUBTOTAL-TEXT'),
    discount: money(40, 'DISCOUNT-TEXT'),
    total: money(499, 'TOTAL-TEXT'),
  };
  cart.checkout = {
    allowed: true,
    blockers: [],
    minimumOrder: { amount: money(300, 'MINIMUM-TEXT'), remaining: money(0, 'REMAINING-TEXT'), progressPercent: 100 },
  };
  return cart;
}

describe('CartSummary', () => {
  it('shows the totals, blockers and minimum order from the API and disables checkout (en)', () => {
    const cart = cartFixture('en');
    const minimumOrder = cart.checkout.minimumOrder!;
    render(<CartSummary cart={cart} locale="en" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByTestId('cart-item-count')).toHaveTextContent('3');
    expect(within(summary).getByTestId('cart-subtotal').textContent).toBe(cart.summary.subtotal.display);
    expect(within(summary).getByTestId('cart-total').textContent).toBe(cart.summary.total.display);
    expect(within(summary).queryByTestId('cart-discount')).toBeNull();

    const blockers = within(summary).getByTestId('checkout-blockers');
    expect(blockers).toHaveTextContent(cart.checkout.blockers[0].message);

    const minimum = within(summary).getByTestId('cart-minimum-order');
    expect(minimum).toHaveTextContent(minimumOrder.amount.display);
    expect(within(minimum).getByTestId('cart-minimum-remaining').textContent).toBe(minimumOrder.remaining.display);
    expect(within(minimum).getByTestId('cart-minimum-bar').style.getPropertyValue('--cart-progress')).toBe(`${minimumOrder.progressPercent}%`);

    const checkout = within(summary).getByRole('button', { name: 'Checkout' });
    expect(checkout).toBeDisabled();
    expect(checkout).toHaveAttribute('aria-describedby', blockers.id);
    expect(within(summary).queryByRole('link', { name: 'Checkout' })).toBeNull();
  });

  it('renders in Arabic', () => {
    const cart = cartFixture('ar');
    render(<CartSummary cart={cart} locale="ar" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByRole('heading', { name: 'ملخص الطلب' })).toBeVisible();
    expect(within(summary).getByTestId('cart-total').textContent).toBe(cart.summary.total.display);
    expect(within(summary).getByTestId('checkout-blockers')).toHaveTextContent(cart.checkout.blockers[0].message);
    expect(within(summary).getByTestId('cart-minimum-remaining').textContent).toBe(cart.checkout.minimumOrder!.remaining.display);
    expect(within(summary).getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled();
  });

  it('enables checkout only when the API allows it, showing its numbers as they are', () => {
    render(<CartSummary cart={checkoutReadyCart()} locale="en" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');
    expect(within(summary).queryByRole('button', { name: 'Checkout' })).toBeNull();
    expect(within(summary).queryByTestId('checkout-blockers')).toBeNull();
    expect(within(summary).getByTestId('cart-subtotal').textContent).toBe('SUBTOTAL-TEXT');
    expect(within(summary).getByTestId('cart-discount').textContent).toBe('DISCOUNT-TEXT');
    expect(within(summary).getByTestId('cart-total').textContent).toBe('TOTAL-TEXT');
    expect(within(summary).getByTestId('cart-minimum-order')).toHaveTextContent('Minimum order reached');
  });

  it('fills the minimum-order bar to the backend progress, never its own', () => {
    const cart = cartFixture('en');
    // 104 of 300 left would be 65%: the bar must use the backend's number anyway
    cart.checkout.minimumOrder = { ...cart.checkout.minimumOrder!, progressPercent: 42 };
    render(<CartSummary cart={cart} locale="en" />);
    expect(screen.getByTestId('cart-minimum-bar').style.getPropertyValue('--cart-progress')).toBe('42%');
  });

  it('enables checkout in Arabic when allowed', () => {
    const cart = cartFixture('ar');
    cart.checkout = { ...cart.checkout, allowed: true, blockers: [] };
    render(<CartSummary cart={cart} locale="ar" />);
    expect(screen.getByRole('link', { name: 'إتمام الطلب' })).toHaveAttribute('href', '/ar/checkout');
  });

  it('keeps checkout disabled while an update is on its way', () => {
    render(<CartSummary cart={checkoutReadyCart()} locale="en" pending />);
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
    expect(screen.getByTestId('cart-summary')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows every blocker and the prescription notice', () => {
    const cart = cartFixture('en');
    cart.requiresPrescription = true;
    cart.checkout.blockers.push({ code: 'unavailable_items', message: 'Remove or update the items that are not available.' });
    render(<CartSummary cart={cart} locale="en" />);

    const items = within(screen.getByTestId('checkout-blockers')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(cart.checkout.blockers.map((blocker) => blocker.message));
    expect(items).toHaveLength(2);
    expect(screen.getByTestId('cart-prescription')).toHaveTextContent('Your cart has products that require a prescription.');
  });

  it('has no minimum-order bar when the store has no minimum', () => {
    const cart = cartFixture('en');
    cart.checkout.minimumOrder = null;
    render(<CartSummary cart={cart} locale="en" />);
    expect(screen.queryByTestId('cart-minimum-order')).toBeNull();
  });
});
