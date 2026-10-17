/** @vitest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Me, ProductCard as ProductCardData } from '@/sdk';
import { addToCartAction, type ShopperActionResult } from '@/lib/shopper.actions';
import { anonymousMeFixture, homeFixture, meFixture } from '@/test/fixtures';
import { ProductCard } from '../product/ProductCard';
import { HeaderBadges } from './HeaderBadges';
import { ShopperStateProvider } from './ShopperStateProvider';

vi.mock('@/lib/shopper.actions', () => ({ addToCartAction: vi.fn(), toggleWishlistAction: vi.fn(), toggleCompareAction: vi.fn() }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en', useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }) }));

const features = { wishlist: true, compare: true };
const badgeFeatures = { wishlist: true, compare: true, notifications: true };
const cards = homeFixture('en').sections.flatMap((s) => s.products).filter((p) => p.purchase.canAddToCart);

function withCart(me: Me, cart: number, productId: number): Me {
  return { ...me, authenticated: true, isGuest: true, counts: { ...me.counts, cart }, cartQuantities: { ...me.cartQuantities, [productId]: 1 } };
}

function page(me: Me | null, products: ProductCardData[] = cards.slice(0, 2)) {
  return (
    <ShopperStateProvider me={me} features={features}>
      <HeaderBadges locale="en" me={me} features={badgeFeatures} />
      {products.map((card) => (
        <ProductCard key={card.id} product={card} locale="en" />
      ))}
    </ShopperStateProvider>
  );
}

function deferred() {
  let resolve!: (value: ShopperActionResult) => void;
  const promise = new Promise<ShopperActionResult>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.mocked(addToCartAction).mockReset();
  refresh.mockReset();
});

describe('ShopperStateProvider after add to cart', () => {
  it('shows the counts of the action answer at once, then refreshes the page in the background', async () => {
    const anonymous = anonymousMeFixture();
    const [card] = cards;
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.', me: withCart(anonymous, 1, card.id) });
    const user = userEvent.setup();
    render(page(anonymous));

    expect(screen.getByRole('link', { name: 'Cart' })).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);

    expect(await screen.findByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('does not refresh when the action answer already carried the re-rendered page (it started the guest session)', async () => {
    const anonymous = anonymousMeFixture();
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.', me: withCart(anonymous, 1, cards[0].id), rendered: true });
    const user = userEvent.setup();
    render(page(anonymous));

    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    expect(await screen.findByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
    await act(async () => new Promise((r) => setTimeout(r, 5)));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes once after writes that overlap', async () => {
    const anonymous = anonymousMeFixture();
    const first = deferred();
    const second = deferred();
    vi.mocked(addToCartAction).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(page(anonymous));

    const [a, b] = screen.getAllByRole('button', { name: /add to cart/i });
    await user.click(a);
    await user.click(b);
    await act(async () => first.resolve({ ok: true, message: 'Added to cart.', me: withCart(anonymous, 1, cards[0].id) }));
    await act(async () => new Promise((r) => setTimeout(r, 5)));
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();

    await act(async () => second.resolve({ ok: true, message: 'Added to cart.', me: withCart(withCart(anonymous, 2, cards[0].id), 2, cards[1].id) }));
    expect(await screen.findByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it('keeps the rendered counts when the answer has none, and refreshes', async () => {
    const me = meFixture('en');
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.', me: null });
    const user = userEvent.setup();
    const product = cards.find((card) => !(card.id in me.cartQuantities))!;
    render(page(me, [product]));

    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    // No counts in the answer: the badge keeps the rendered one until the refresh brings the new one.
    expect(screen.getByRole('link', { name: `Cart, ${me.counts.cart} items` })).toBeInTheDocument();
  });

  it('takes the server value again when the layout renders a new GET /me', async () => {
    const anonymous = anonymousMeFixture();
    vi.mocked(addToCartAction).mockResolvedValue({ ok: true, message: 'Added to cart.', me: withCart(anonymous, 1, cards[0].id) });
    const user = userEvent.setup();
    const view = render(page(anonymous));
    await user.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    await screen.findByRole('link', { name: 'Cart, 1 item' });

    view.rerender(page(withCart(anonymous, 3, cards[0].id)));
    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument();
  });
});
