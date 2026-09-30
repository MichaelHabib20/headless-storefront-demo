/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CartItem, CartItemAvailability } from '@/sdk';
import { cartFixture } from '@/test/fixtures';
import { CartLineItem } from './CartLineItem';

const firstLine = (locale: 'en' | 'ar' = 'en') => cartFixture(locale).items[0];

/** A copy of a real line in another availability state (as the backend would send it). */
function lineWith(availability: Partial<CartItemAvailability>, overrides: Partial<CartItem> = {}): CartItem {
  const item = firstLine();
  return { ...item, ...overrides, availability: { ...item.availability, ...availability } };
}

describe('CartLineItem', () => {
  it('shows the product, its link and the prices from the API (en)', () => {
    const item = firstLine('en');
    render(<CartLineItem item={item} locale="en" />);
    const line = screen.getByTestId('cart-line');

    expect(within(line).getByRole('link', { name: item.product.name })).toHaveAttribute('href', `/en/p/${item.product.slug}`);
    expect(line).toHaveTextContent('JOHNSON & JOHNSON');
    expect(line).toHaveTextContent(item.unitPrice.display);
    expect(within(line).getByTestId('cart-line-total')).toHaveTextContent(item.lineTotal.display);
    expect(within(line).getByTestId('cart-quantity')).toHaveTextContent('2');
    expect(line).toHaveAttribute('data-status', 'available');
    expect(within(line).queryByTestId('cart-line-availability')).toBeNull();
  });

  it('renders in Arabic: the API texts, Arabic digits for the quantity', () => {
    const item = firstLine('ar');
    render(<CartLineItem item={item} locale="ar" onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    const line = screen.getByTestId('cart-line');

    expect(within(line).getByRole('link', { name: item.product.name })).toHaveAttribute('href', `/ar/p/${item.product.slug}`);
    expect(within(line).getByTestId('cart-line-total')).toHaveTextContent(item.lineTotal.display);
    expect(within(line).getByTestId('cart-quantity')).toHaveTextContent('٢');
    expect(within(line).getByRole('button', { name: 'زيادة الكمية' })).toBeEnabled();
    expect(within(line).getByRole('button', { name: 'حذف' })).toBeEnabled();
  });

  it('steps the quantity inside the backend limits', async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(<CartLineItem item={firstLine()} locale="en" onQuantityChange={onQuantityChange} onRemove={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Increase quantity' }));
    await user.click(screen.getByRole('button', { name: 'Decrease quantity' }));
    expect(onQuantityChange.mock.calls).toEqual([[3], [1]]);
  });

  it('disables the buttons at the minimum and maximum', () => {
    const { rerender } = render(<CartLineItem item={{ ...firstLine(), quantity: 5 }} locale="en" onQuantityChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeEnabled();

    rerender(<CartLineItem item={{ ...firstLine(), quantity: 1 }} locale="en" onQuantityChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeEnabled();
  });

  it('shows an out-of-stock line with the backend message and only lets the shopper remove it', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<CartLineItem item={lineWith({ status: 'out_of_stock', message: 'Out of stock' })} locale="en" onQuantityChange={vi.fn()} onRemove={onRemove} />);
    const line = screen.getByTestId('cart-line');

    expect(line).toHaveAttribute('data-status', 'out_of_stock');
    expect(line.className).toContain('unavailable');
    expect(within(line).getByTestId('cart-line-availability')).toHaveTextContent('Out of stock');
    expect(within(line).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(within(line).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();

    await user.click(within(line).getByRole('button', { name: 'Remove' }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('shows an over-the-limit line and steps straight back to the maximum', async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    const item = lineWith({ status: 'exceeds_limit', message: 'You can buy up to 5 of this item.' }, { quantity: 8 });
    render(<CartLineItem item={item} locale="en" onQuantityChange={onQuantityChange} />);
    const line = screen.getByTestId('cart-line');

    expect(line).toHaveAttribute('data-status', 'exceeds_limit');
    expect(within(line).getByTestId('cart-line-availability')).toHaveTextContent('You can buy up to 5 of this item.');
    expect(within(line).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    await user.click(within(line).getByRole('button', { name: 'Decrease quantity' }));
    expect(onQuantityChange).toHaveBeenCalledWith(5);
  });

  it('explains an unavailable line even when the backend sends no message', () => {
    render(<CartLineItem item={lineWith({ status: 'unavailable', message: null })} locale="ar" />);
    expect(screen.getByTestId('cart-line-availability')).toHaveTextContent('لا يمكن طلب هذا المنتج بحالته الحالية.');
  });

  it('shows the optimistic quantity as pending and locks the controls', () => {
    render(<CartLineItem item={firstLine()} locale="en" quantity={3} pending disabled onQuantityChange={vi.fn()} onRemove={vi.fn()} />);
    const line = screen.getByTestId('cart-line');

    expect(within(line).getByTestId('cart-quantity')).toHaveTextContent('3');
    // the line total is still the API's last answer, never recomputed for the new quantity
    expect(within(line).getByTestId('cart-line-total')).toHaveTextContent(firstLine().lineTotal.display);
    expect(line).toHaveAttribute('aria-busy', 'true');
    for (const button of within(line).getAllByRole('button')) expect(button).toBeDisabled();
  });

  it('shows a discounted unit price exactly as the API wrote it', () => {
    const item = firstLine();
    const unitPrice = { ...item.unitPrice, compareAt: 999, discountPercent: 1, display: 'PRICE-TEXT-1', compareAtDisplay: 'OLD-PRICE-TEXT-1', discountLabel: 'DISCOUNT-TEXT-1' };
    render(<CartLineItem item={{ ...item, unitPrice }} locale="en" />);
    const line = screen.getByTestId('cart-line');

    expect(line).toHaveTextContent('PRICE-TEXT-1');
    expect(line.querySelector('s')).toHaveTextContent('OLD-PRICE-TEXT-1');
    expect(line.querySelector('[class*="discount"]')).toHaveTextContent('DISCOUNT-TEXT-1');
    expect(line).not.toHaveTextContent('999');
  });

  it('marks products that need a prescription', () => {
    const item = firstLine();
    render(<CartLineItem item={{ ...item, product: { ...item.product, requiresPrescription: true } }} locale="en" />);
    expect(screen.getByTestId('cart-line')).toHaveTextContent('Prescription required');
  });
});
