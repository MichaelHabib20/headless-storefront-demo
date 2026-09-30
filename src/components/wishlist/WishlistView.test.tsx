/** @vitest-environment jsdom */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/sdk';
import { wishlistFixture } from '@/test/fixtures';
import type { WishlistActionResult } from './WishlistGrid';
import { WishlistView, type WishlistState } from './WishlistView';

const ok = (locale: Locale): WishlistState => ({ status: 'ok', wishlist: wishlistFixture(locale) });
const idle = () => vi.fn(async (): Promise<WishlistActionResult> => ({ ok: true }));

function deferred() {
  let settle!: (result: WishlistActionResult) => void;
  const action = vi.fn(() => new Promise<WishlistActionResult>((resolve) => (settle = resolve)));
  return { action, settle: (result: WishlistActionResult) => act(async () => settle(result)) };
}

describe('WishlistView', () => {
  it.each(['en', 'ar'] as const)('shows every saved product with its actions (%s)', (locale) => {
    const wishlist = wishlistFixture(locale);
    render(<WishlistView state={ok(locale)} locale={locale} onRemove={idle()} onMoveToCart={idle()} />);

    const items = screen.getAllByTestId('wishlist-item');
    expect(items).toHaveLength(wishlist.items.length);
    wishlist.items.forEach((product, i) => {
      expect(within(items[i]).getByTestId('product-card')).toHaveTextContent(product.name);
      expect(within(items[i]).getByRole('link')).toHaveAttribute('href', `/${locale}/p/${encodeURIComponent(product.slug)}`);
      expect(within(items[i]).getAllByRole('button')).toHaveLength(2);
    });
  });

  it('renders English labels, the total and page links', () => {
    render(<WishlistView state={ok('en')} locale="en" onRemove={idle()} onMoveToCart={idle()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'My wishlist' })).toBeInTheDocument();
    expect(screen.getByText('Saved items: 3')).toBeInTheDocument();
    const [first] = wishlistFixture('en').items;
    expect(screen.getByRole('button', { name: `Remove ${first.name}` })).toBeEnabled();
    expect(screen.getByRole('button', { name: `Add to bag ${first.name}` })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Move to cart/ })).toBeNull();

    const nav = screen.getByRole('navigation', { name: 'Wishlist pages' });
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/en/wishlist?page=2');
    expect(within(nav).getByRole('link', { name: 'Next' })).toHaveAttribute('href', '/en/wishlist?page=2');
    expect(within(nav).queryByRole('link', { name: 'Previous' })).toBeNull();
  });

  it('renders Arabic labels, digits and page links', () => {
    render(<WishlistView state={ok('ar')} locale="ar" pageQuery={{ perPage: 2 }} onRemove={idle()} onMoveToCart={idle()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'قائمة المفضلة' })).toBeInTheDocument();
    expect(screen.getByText('المنتجات المحفوظة: ٣')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^أضف إلى الحقيبة/ })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /^إزالة/ })).toHaveLength(2);

    const nav = screen.getByRole('navigation', { name: 'صفحات المفضلة' });
    expect(within(nav).getByRole('link', { name: 'صفحة ٢' })).toHaveAttribute('href', '/ar/wishlist?page=2&perPage=2');
    expect(within(nav).getByRole('link', { name: 'التالي' })).toHaveAttribute('href', '/ar/wishlist?page=2&perPage=2');
  });

  it('hides page links when everything fits on one page', () => {
    const wishlist = wishlistFixture('en');
    wishlist.pagination = { page: 1, perPage: 12, total: 2, totalPages: 1 };
    render(<WishlistView state={{ status: 'ok', wishlist }} locale="en" onRemove={idle()} onMoveToCart={idle()} />);
    expect(screen.queryByTestId('pagination')).toBeNull();
  });

  it('disables "Add to bag" when the API says the product cannot be added', () => {
    const wishlist = wishlistFixture('en');
    wishlist.items[0].purchase.canAddToCart = false;
    render(<WishlistView state={{ status: 'ok', wishlist }} locale="en" onRemove={idle()} onMoveToCart={idle()} />);
    expect(screen.getByRole('button', { name: `Add to bag ${wishlist.items[0].name}` })).toBeDisabled();
    expect(screen.getByRole('button', { name: `Add to bag ${wishlist.items[1].name}` })).toBeEnabled();
  });

  it.each([
    ['en', 'Your wishlist is empty', 'Start shopping'],
    ['ar', 'قائمة المفضلة فارغة', 'ابدأ التسوق'],
  ] as const)('shows an empty state for a visitor without a session (%s)', (locale, title, cta) => {
    render(<WishlistView state={{ status: 'guest' }} locale={locale} onRemove={idle()} onMoveToCart={idle()} />);
    const empty = screen.getByTestId('wishlist-empty');
    expect(within(empty).getByRole('heading', { name: title })).toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: cta })).toHaveAttribute('href', `/${locale}`);
    expect(screen.queryByTestId('wishlist-item')).toBeNull();
    expect(screen.queryByTestId('pagination')).toBeNull();
  });

  it('shows the empty state for an empty list', () => {
    const wishlist = wishlistFixture('en');
    wishlist.items = [];
    wishlist.pagination = { page: 1, perPage: 12, total: 0, totalPages: 0 };
    render(<WishlistView state={{ status: 'ok', wishlist }} locale="en" onRemove={idle()} onMoveToCart={idle()} />);
    expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument();
    expect(screen.queryByText(/Saved items/)).toBeNull();
  });

  it('says so when the wishlist could not be loaded', () => {
    render(<WishlistView state={{ status: 'error' }} locale="en" onRemove={idle()} onMoveToCart={idle()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your wishlist');
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en/wishlist');
  });

  it('hides a removed item at once and brings it back when the API refuses', async () => {
    const user = userEvent.setup();
    const remove = deferred();
    const [first, second] = wishlistFixture('en').items;
    render(<WishlistView state={ok('en')} locale="en" onRemove={remove.action} onMoveToCart={idle()} />);

    await user.click(screen.getByRole('button', { name: `Remove ${first.name}` }));
    expect(remove.action).toHaveBeenCalledWith('en', first.id);
    expect(screen.getAllByTestId('wishlist-item')).toHaveLength(1);
    expect(screen.getByTestId('wishlist-item')).toHaveTextContent(second.name);

    await remove.settle({ ok: false, message: 'Not found.' });
    await waitFor(() => expect(screen.getAllByTestId('wishlist-item')).toHaveLength(2));
    expect(screen.getByRole('alert')).toHaveTextContent('Not found.');
  });

  it('confirms a removal and shows the list the server sends back', async () => {
    const user = userEvent.setup();
    const onRemove = idle();
    const [first] = wishlistFixture('en').items;
    const { rerender } = render(<WishlistView state={ok('en')} locale="en" onRemove={onRemove} onMoveToCart={idle()} />);

    await user.click(screen.getByRole('button', { name: `Remove ${first.name}` }));
    expect(await screen.findByText('Removed from your wishlist.')).toBeInTheDocument();

    const next = wishlistFixture('en');
    next.items = next.items.slice(1);
    rerender(<WishlistView state={{ status: 'ok', wishlist: next }} locale="en" onRemove={onRemove} onMoveToCart={idle()} />);
    expect(screen.getAllByTestId('wishlist-item')).toHaveLength(1);
    expect(screen.queryByText(first.name)).toBeNull();
  });

  it('moves an item to the cart and links to the cart (ar)', async () => {
    const user = userEvent.setup();
    const move = deferred();
    const [first] = wishlistFixture('ar').items;
    render(<WishlistView state={ok('ar')} locale="ar" onRemove={idle()} onMoveToCart={move.action} />);

    await user.click(screen.getByRole('button', { name: `أضف إلى الحقيبة ${first.name}` }));
    expect(move.action).toHaveBeenCalledWith('ar', first.id);
    expect(screen.getAllByTestId('wishlist-item')).toHaveLength(1);

    await move.settle({ ok: true });
    const status = screen.getByTestId('wishlist-status');
    expect(status).toHaveTextContent('تم نقل المنتج إلى السلة.');
    expect(within(status).getByRole('link', { name: 'عرض السلة' })).toHaveAttribute('href', '/ar/cart');
  });

  it('rolls back and shows a generic message when the action itself fails', async () => {
    const user = userEvent.setup();
    const onMoveToCart = vi.fn(async (): Promise<WishlistActionResult> => {
      throw new Error('offline');
    });
    const [first] = wishlistFixture('en').items;
    render(<WishlistView state={ok('en')} locale="en" onRemove={idle()} onMoveToCart={onMoveToCart} />);

    await user.click(screen.getByRole('button', { name: `Add to bag ${first.name}` }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not update your wishlist. Please try again.');
    await waitFor(() => expect(screen.getAllByTestId('wishlist-item')).toHaveLength(2));
  });
});
