/** @vitest-environment jsdom */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale, Me, ProductCard as ProductCardData } from '@/sdk';
import { addToCartAction, toggleCompareAction, toggleWishlistAction, type ShopperActionResult } from '@/lib/shopper.actions';
import { anonymousMeFixture, homeFixture, meFixture } from '@/test/fixtures';
import { ShopperStateProvider } from '../shopper/ShopperStateProvider';
import type { ShopperFeatures } from '../shopper/state';
import { ProductCard } from './ProductCard';

vi.mock('@/lib/shopper.actions', () => ({
  addToCartAction: vi.fn(),
  toggleWishlistAction: vi.fn(),
  toggleCompareAction: vi.fn(),
}));

const allOn: ShopperFeatures = { wishlist: true, compare: true };

function product(id: number, locale: Locale = 'en', overrides: Partial<ProductCardData> = {}): ProductCardData {
  const found = homeFixture(locale).sections.flatMap((s) => s.products).find((p) => p.id === id)!;
  return { ...found, ...overrides };
}

function Shell({ me, features = allOn, children }: { me: Me | null; features?: ShopperFeatures; children: ReactNode }) {
  return (
    <ShopperStateProvider me={me} features={features}>
      {children}
    </ShopperStateProvider>
  );
}

function renderCard(card: ProductCardData, { me = anonymousMeFixture() as Me | null, features = allOn, locale = 'en' as Locale } = {}) {
  const view = render(
    <Shell me={me} features={features}>
      <ProductCard product={card} locale={locale} />
    </Shell>,
  );
  const group = screen.getByRole('group', { name: card.name });
  return { ...view, group };
}

function deferred() {
  let resolve!: (value: ShopperActionResult) => void;
  const promise = new Promise<ShopperActionResult>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(addToCartAction).mockReset();
  vi.mocked(toggleWishlistAction).mockReset();
  vi.mocked(toggleCompareAction).mockReset();
});

describe('ProductActions', () => {
  it('starts from the shopper state in Me', () => {
    const me = meFixture('en');
    const inCart = renderCard(product(36480), { me });
    expect(within(inCart.group).getByRole('link', { name: 'In cart (2)' })).toHaveAttribute('href', '/en/cart');
    expect(within(inCart.group).queryByRole('button', { name: 'Add to cart' })).toBeNull();
    expect(within(inCart.group).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(inCart.group).getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-pressed', 'true');
    inCart.unmount();

    const saved = renderCard(product(8412), { me });
    expect(within(saved.group).getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    expect(within(saved.group).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(saved.group).getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('has nothing pressed for an anonymous visitor', () => {
    const { group } = renderCard(product(36480));
    expect(within(group).getByRole('button', { name: 'Add to cart' })).toBeEnabled();
    expect(within(group).getByRole('button', { name: 'Save to wishlist' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables add to cart when the backend says the product cannot be added', async () => {
    const card = product(9822, 'en', { purchase: { canAddToCart: false, minQuantity: 1, maxQuantity: null } });
    const { group } = renderCard(card);
    const add = within(group).getByRole('button', { name: 'Add to cart' });
    expect(add).toBeDisabled();
    await userEvent.setup().click(add);
    expect(addToCartAction).not.toHaveBeenCalled();
  });

  it('hides wishlist and compare when the store switched them off', () => {
    const { group } = renderCard(product(36480), { features: { wishlist: false, compare: false } });
    expect(within(group).queryByRole('button', { name: 'Save to wishlist' })).toBeNull();
    expect(within(group).queryByRole('button', { name: 'Compare' })).toBeNull();
    expect(within(group).getByRole('button', { name: 'Add to cart' })).toBeInTheDocument();
  });

  it('adds to cart with the backend minimum quantity and announces it', async () => {
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.' });
    const card = product(9822, 'en', { purchase: { canAddToCart: true, minQuantity: 2, maxQuantity: 10 } });
    const { group } = renderCard(card);

    await userEvent.setup().click(within(group).getByRole('button', { name: 'Add to cart' }));

    expect(addToCartAction).toHaveBeenCalledWith('en', 9822, 2);
    expect(within(group).getByRole('status')).toHaveTextContent('Added to cart.');
    const link = within(group).getByRole('link', { name: 'In cart (2)' });
    expect(link).toHaveAttribute('href', '/en/cart');
    expect(link).toHaveFocus();
  });

  it('toggles the wishlist optimistically', async () => {
    const pending = deferred();
    vi.mocked(toggleWishlistAction).mockReturnValue(pending.promise);
    const { group } = renderCard(product(9822));
    const heart = within(group).getByRole('button', { name: 'Save to wishlist' });

    await userEvent.setup().click(heart);
    expect(toggleWishlistAction).toHaveBeenCalledWith('en', 9822, true);
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(heart).toHaveAttribute('aria-busy', 'true');

    await act(async () => pending.resolve({ ok: true, message: 'Saved to your wishlist.' }));
    expect(heart).toHaveAttribute('aria-pressed', 'true');
    expect(heart).not.toHaveAttribute('aria-busy');
    expect(within(group).getByRole('status')).toHaveTextContent('Saved to your wishlist.');
  });

  // Regression (live staging): two quick first clicks started two guest sessions.
  it('runs writes one at a time: the second starts only after the first finished', async () => {
    const wishlist = deferred();
    vi.mocked(toggleWishlistAction).mockReturnValue(wishlist.promise);
    vi.mocked(toggleCompareAction).mockResolvedValue({ ok: true, message: 'Added to compare.' });
    const { group } = renderCard(product(9822));
    const user = userEvent.setup();

    await user.click(within(group).getByRole('button', { name: 'Save to wishlist' }));
    await user.click(within(group).getByRole('button', { name: 'Compare' }));
    expect(toggleWishlistAction).toHaveBeenCalledTimes(1);
    expect(toggleCompareAction).not.toHaveBeenCalled();

    await act(async () => wishlist.resolve({ ok: true, message: 'Saved to your wishlist.' }));
    expect(toggleCompareAction).toHaveBeenCalledWith('en', 9822, true);
  });

  it('removes from the wishlist when it is already saved', async () => {
    vi.mocked(toggleWishlistAction).mockResolvedValue({ ok: true, message: 'Removed from your wishlist.' });
    const { group } = renderCard(product(8412), { me: meFixture('en') });
    const heart = within(group).getByRole('button', { name: 'Save to wishlist' });

    await userEvent.setup().click(heart);
    expect(toggleWishlistAction).toHaveBeenCalledWith('en', 8412, false);
    expect(heart).toHaveAttribute('aria-pressed', 'false');
  });

  // QA 2026-10-17: buttons past the compare maximum looked pressed while /compare held 4 products.
  it('presses compare only once the backend accepted it; a full list leaves it unpressed', async () => {
    const pending = deferred();
    vi.mocked(toggleCompareAction).mockReturnValue(pending.promise);
    const { group } = renderCard(product(9822));
    const compare = within(group).getByRole('button', { name: 'Compare' });
    const user = userEvent.setup();

    await user.click(compare);
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    expect(compare).toHaveAttribute('aria-busy', 'true');
    // a second click while the first is on its way sends nothing more
    await user.click(compare);
    expect(toggleCompareAction).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve({ ok: false, message: 'You can compare up to 4 products.' }));
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    expect(compare).not.toHaveAttribute('aria-busy');
    expect(within(group).getByRole('status')).toHaveTextContent('You can compare up to 4 products.');
  });

  it('presses compare after the backend added the product', async () => {
    const pending = deferred();
    vi.mocked(toggleCompareAction).mockReturnValue(pending.promise);
    const { group } = renderCard(product(9822));
    const compare = within(group).getByRole('button', { name: 'Compare' });

    await userEvent.setup().click(compare);
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    await act(async () => pending.resolve({ ok: true, message: 'Added to compare.' }));
    expect(compare).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('status')).toHaveTextContent('Added to compare.');
  });

  it('takes a product out of compare optimistically and puts it back when refused', async () => {
    const pending = deferred();
    vi.mocked(toggleCompareAction).mockReturnValue(pending.promise);
    const { group } = renderCard(product(8412), { me: meFixture('en') });
    const compare = within(group).getByRole('button', { name: 'Compare' });

    await userEvent.setup().click(compare);
    expect(toggleCompareAction).toHaveBeenCalledWith('en', 8412, false);
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    await act(async () => pending.resolve({ ok: false, message: 'Something went wrong. Please try again.' }));
    expect(compare).toHaveAttribute('aria-pressed', 'true');
  });

  it('a refused compare stays unpressed in Arabic', async () => {
    vi.mocked(toggleCompareAction).mockResolvedValue({ ok: false, message: 'يمكنك مقارنة 4 منتجات كحد أقصى.' });
    const { group } = renderCard(product(9822, 'ar'), { locale: 'ar' });
    const compare = within(group).getByRole('button', { name: 'قارن' });
    await userEvent.setup().click(compare);
    expect(compare).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('status')).toHaveTextContent('يمكنك مقارنة 4 منتجات كحد أقصى.');
  });

  it('rolls back with a generic message when the action cannot run', async () => {
    vi.mocked(toggleWishlistAction).mockRejectedValue(new Error('offline'));
    const { group } = renderCard(product(9822));
    const heart = within(group).getByRole('button', { name: 'Save to wishlist' });

    await userEvent.setup().click(heart);
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('status')).toHaveTextContent('Something went wrong. Please try again.');
  });

  it('follows the server state when the layout is revalidated', () => {
    const card = product(9822);
    const me = anonymousMeFixture();
    const { rerender, group } = renderCard(card, { me });
    expect(within(group).getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-pressed', 'false');

    const refreshed: Me = { ...me, cartQuantities: { '9822': 3 }, compareProductIds: [9822] };
    rerender(
      <Shell me={refreshed}>
        <ProductCard product={card} locale="en" />
      </Shell>,
    );
    const updated = screen.getByRole('group', { name: card.name });
    expect(within(updated).getByRole('button', { name: 'Compare' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(updated).getByRole('link', { name: 'In cart (3)' })).toBeInTheDocument();
  });

  it('speaks Arabic', () => {
    const { group } = renderCard(product(36480, 'ar'), { me: meFixture('ar'), locale: 'ar' });
    expect(within(group).getByRole('link', { name: 'في السلة (2)' })).toHaveAttribute('href', '/ar/cart');
    expect(within(group).getByRole('button', { name: 'حفظ في المفضلة' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'قارن' })).toHaveAttribute('aria-pressed', 'true');
  });
});
