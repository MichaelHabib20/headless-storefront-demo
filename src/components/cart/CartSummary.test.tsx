/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Cart } from '@/sdk';
import { cartFixture } from '@/test/fixtures';
import { CartSummary } from './CartSummary';

/**
 * A copy of the real cart where checkout is allowed. The numbers are deliberately NOT
 * consistent with each other (subtotal - discount ≠ total): the summary must show what
 * the API says, not what it would compute.
 */
function checkoutReadyCart(): Cart {
  const cart = cartFixture('en');
  cart.summary = {
    itemCount: 4,
    subtotal: { amount: 512, currency: 'EGP' },
    discount: { amount: 40, currency: 'EGP' },
    total: { amount: 499, currency: 'EGP' },
  };
  cart.checkout = {
    allowed: true,
    blockers: [],
    minimumOrder: { amount: { amount: 300, currency: 'EGP' }, remaining: { amount: 0, currency: 'EGP' } },
  };
  return cart;
}

describe('CartSummary', () => {
  it('shows the totals, blockers and minimum order from the API and disables checkout (en)', () => {
    render(<CartSummary cart={cartFixture('en')} locale="en" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByTestId('cart-item-count')).toHaveTextContent('3');
    expect(within(summary).getByTestId('cart-subtotal')).toHaveTextContent('EGP 196');
    expect(within(summary).getByTestId('cart-total')).toHaveTextContent('EGP 196');
    expect(within(summary).queryByTestId('cart-discount')).toBeNull();

    const blockers = within(summary).getByTestId('checkout-blockers');
    expect(blockers).toHaveTextContent('Add EGP 104 more to reach the minimum order.');

    const minimum = within(summary).getByTestId('cart-minimum-order');
    expect(minimum).toHaveTextContent('EGP 300');
    expect(within(minimum).getByTestId('cart-minimum-remaining')).toHaveTextContent('EGP 104');

    const checkout = within(summary).getByRole('button', { name: 'Checkout' });
    expect(checkout).toBeDisabled();
    expect(checkout).toHaveAttribute('aria-describedby', blockers.id);
    expect(within(summary).queryByRole('link', { name: 'Checkout' })).toBeNull();
  });

  it('renders in Arabic', () => {
    render(<CartSummary cart={cartFixture('ar')} locale="ar" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByRole('heading', { name: 'ملخص الطلب' })).toBeVisible();
    expect(within(summary).getByTestId('cart-total')).toHaveTextContent('١٩٦ ج.م');
    expect(within(summary).getByTestId('checkout-blockers')).toHaveTextContent('أضف 104 ج.م للوصول للحد الأدنى للطلب.');
    expect(within(summary).getByTestId('cart-minimum-remaining')).toHaveTextContent('١٠٤ ج.م');
    expect(within(summary).getByRole('button', { name: 'إتمام الطلب' })).toBeDisabled();
  });

  it('enables checkout only when the API allows it, showing its numbers as they are', () => {
    render(<CartSummary cart={checkoutReadyCart()} locale="en" />);
    const summary = screen.getByTestId('cart-summary');

    expect(within(summary).getByRole('link', { name: 'Checkout' })).toHaveAttribute('href', '/en/checkout');
    expect(within(summary).queryByRole('button', { name: 'Checkout' })).toBeNull();
    expect(within(summary).queryByTestId('checkout-blockers')).toBeNull();
    expect(within(summary).getByTestId('cart-subtotal')).toHaveTextContent('EGP 512');
    expect(within(summary).getByTestId('cart-discount')).toHaveTextContent('EGP 40');
    expect(within(summary).getByTestId('cart-total')).toHaveTextContent('EGP 499');
    expect(within(summary).getByTestId('cart-minimum-order')).toHaveTextContent('Minimum order reached');
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
    expect(items.map((item) => item.textContent)).toEqual([
      'Add EGP 104 more to reach the minimum order.',
      'Remove or update the items that are not available.',
    ]);
    expect(screen.getByTestId('cart-prescription')).toHaveTextContent('Your cart has products that require a prescription.');
  });

  it('has no minimum-order bar when the store has no minimum', () => {
    const cart = cartFixture('en');
    cart.checkout.minimumOrder = null;
    render(<CartSummary cart={cart} locale="en" />);
    expect(screen.queryByTestId('cart-minimum-order')).toBeNull();
  });
});
