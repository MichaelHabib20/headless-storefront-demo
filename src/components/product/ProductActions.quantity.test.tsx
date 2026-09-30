/** @vitest-environment jsdom */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me } from '@/sdk';
import { addToCartAction, type ShopperActionResult } from '@/lib/shopper.actions';
import { anonymousMeFixture } from '@/test/fixtures';
import { ShopperStateProvider } from '../shopper/ShopperStateProvider';
import { ProductActions, type QuantityPicker } from './ProductActions';

vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));

const labels = { addToCart: 'Add to cart', inCart: 'In cart ({count})', wishlist: 'Save to wishlist', compare: 'Compare', failed: 'Something went wrong. Please try again.' };
const pickerLabels = { quantity: 'Quantity', decrease: 'Decrease quantity', increase: 'Increase quantity', update: 'Update cart' };

function Shell({ me, children }: { me: Me; children: ReactNode }) {
  return (
    <ShopperStateProvider me={me} features={{ wishlist: true, compare: true }}>
      {children}
    </ShopperStateProvider>
  );
}

function renderActions({ me = anonymousMeFixture(), limits = { step: 1, min: 1, max: 3 } as QuantityPicker['limits'], canAddToCart = true, locale = 'en' as 'en' | 'ar' } = {}) {
  const ui = (who: Me) => (
    <Shell me={who}>
      <ProductActions
        productId={9822}
        productName="J&J Baby Cologne"
        locale={locale}
        canAddToCart={canAddToCart}
        addQuantity={limits.min}
        labels={labels}
        quantity={{ limits, labels: pickerLabels }}
      />
    </Shell>
  );
  const view = render(ui(me));
  return { ...view, group: screen.getByRole('group', { name: 'J&J Baby Cologne' }), rerenderWith: (who: Me) => view.rerender(ui(who)) };
}

beforeEach(() => vi.mocked(addToCartAction).mockReset());

describe('ProductActions with a quantity picker (product page)', () => {
  it('steps between the backend minimum and maximum, then puts that quantity in the cart', async () => {
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.' });
    const { group } = renderActions();
    const user = userEvent.setup();
    const up = within(group).getByRole('button', { name: 'Increase quantity' });

    await user.click(up);
    await user.click(up);
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('3');
    expect(up).toBeDisabled(); // the backend's maximum is 3

    await user.click(within(group).getByRole('button', { name: 'Add to cart' }));
    expect(addToCartAction).toHaveBeenCalledWith('en', 9822, 3);
    // two live regions: the quantity (<output>) and the action result
    expect(await within(group).findByText('Added to cart.')).toHaveAttribute('role', 'status');
    const link = await within(group).findByRole('link', { name: 'In cart (3)' });
    expect(link).toHaveFocus();
    expect(within(group).getByRole('button', { name: 'Update cart' })).toBeDisabled();
  });

  it('moves by the backend step (weighed products) from the minimum', async () => {
    const { group } = renderActions({ limits: { step: 0.5, min: 1, max: null } });
    const user = userEvent.setup();

    expect(within(group).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
    await user.click(within(group).getByRole('button', { name: 'Increase quantity' }));
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('1.5');
  });

  it('starts from the cart quantity and updates it', async () => {
    let resolve!: (value: ShopperActionResult) => void;
    vi.mocked(addToCartAction).mockReturnValue(new Promise((r) => (resolve = r)));
    const me = { ...anonymousMeFixture(), cartQuantities: { '9822': 2 } };
    const { group } = renderActions({ me });
    const user = userEvent.setup();

    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('2');
    const update = within(group).getByRole('button', { name: 'Update cart' });
    expect(update).toBeDisabled();

    await user.click(within(group).getByRole('button', { name: 'Decrease quantity' }));
    expect(update).toBeEnabled();
    await user.click(update);
    expect(addToCartAction).toHaveBeenCalledWith('en', 9822, 1);
    expect(group).toHaveAttribute('aria-busy', 'true');

    await act(async () => resolve({ ok: true, message: 'Added to cart.' }));
    expect(within(group).getByRole('link', { name: 'In cart (1)' })).toBeInTheDocument();
  });

  it('keeps the chosen quantity and shows the backend message when the cart refuses it', async () => {
    vi.mocked(addToCartAction).mockResolvedValue({ ok: false, message: 'This quantity is not allowed.' });
    const { group } = renderActions();
    const user = userEvent.setup();

    await user.click(within(group).getByRole('button', { name: 'Increase quantity' }));
    await user.click(within(group).getByRole('button', { name: 'Add to cart' }));
    expect(within(group).getByText('This quantity is not allowed.')).toHaveAttribute('role', 'status');
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('2');
    expect(within(group).queryByRole('link')).toBeNull();
  });

  it('follows the server state when the layout is revalidated', () => {
    const { rerenderWith } = renderActions();
    rerenderWith({ ...anonymousMeFixture(), cartQuantities: { '9822': 3 } });
    const group = screen.getByRole('group', { name: 'J&J Baby Cologne' });
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('3');
    expect(within(group).getByRole('link', { name: 'In cart (3)' })).toBeInTheDocument();
  });

  it('locks the stepper and the button when the backend says it cannot be added', () => {
    const { group } = renderActions({ canAddToCart: false });
    expect(within(group).getByRole('button', { name: 'Add to cart' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('shows the quantity in Arabic digits', () => {
    const { group } = renderActions({ locale: 'ar', me: { ...anonymousMeFixture(), cartQuantities: { '9822': 2 } } });
    expect(within(group).getByTestId('product-quantity')).toHaveTextContent('٢');
  });
});
