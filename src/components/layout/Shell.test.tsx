/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cart } from '@/sdk';
import { cartFixture, layoutFixture, meFixture } from '@/test/fixtures';
import { locationsFixture } from '@/test/account-fixtures';
import { APP_BANNER_COOKIE, FLOATING_BANNER_COOKIE, OPEN_AREA_EVENT } from '@/lib/shell';
import { AppBanner } from './AppBanner';
import { AreaChooser } from './AreaChooser';
import { FloatingBanner, TopBanner } from './Banners';
import { LegalLinks } from './LegalLinks';
import { MiniCartProvider, useMiniCart } from './MiniCart';
import { MobileBottomNav } from './MobileBottomNav';
import { StoreClosedNotice } from './StoreClosedNotice';
import { StoreUnavailable } from './StoreUnavailable';
import { UspStrip } from './UspStrip';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/en/products/deals', useRouter: () => ({ refresh }) }));

// links are not followed in jsdom
document.addEventListener('click', (event) => {
  if ((event.target as HTMLElement).closest('a')) event.preventDefault();
});

beforeEach(() => {
  refresh.mockReset();
  document.cookie.split(';').forEach((part) => (document.cookie = `${part.split('=')[0].trim()}=; Max-Age=0; Path=/`));
});

describe('mobile bottom nav', () => {
  it('draws the API items with badges from Me.counts and opens the more sheet', () => {
    const me = meFixture('en');
    render(<MobileBottomNav nav={layoutFixture('en').mobileNav!} locale="en" me={me} />);
    const bar = screen.getByTestId('mobile-bottom-nav');
    expect(within(bar).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/en', '/en/categories', '/en/products/deals', '/en/cart']);
    expect(within(bar).getByRole('link', { name: /Deals/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('nav-badge-cart')).toHaveTextContent(String(me.counts.cart));

    fireEvent.click(within(bar).getByRole('button', { name: /More/ }));
    const sheet = screen.getByTestId('more-sheet');
    expect(within(sheet).getByRole('heading', { name: 'More' })).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: /Our Branches/ })).toHaveAttribute('href', '/en/pages/branches');
    expect(within(sheet).getByRole('link', { name: /عربي/ })).toHaveAttribute('href', '/ar/products/deals');
    expect(within(sheet).queryByText('Welcome to Seif Pharmacies!')).toBeNull(); // signed in

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('more-sheet')).toBeNull();
  });

  it('welcomes visitors without an account in the sheet (Arabic)', () => {
    render(<MobileBottomNav nav={layoutFixture('ar').mobileNav!} locale="ar" me={null} />);
    fireEvent.click(screen.getByRole('button', { name: /المزيد/ }));
    expect(screen.getByText('مرحبا بك في صيدليات سيف!')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-badge-cart')).toBeNull();
  });

  it('the area item opens the area chooser', () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_AREA_EVENT, listener);
    const nav = layoutFixture('en').mobileNav!;
    render(<MobileBottomNav nav={{ ...nav, items: [...nav.items.slice(0, 4), { id: 'area', label: 'Area', icon: 'location_on', target: null, badge: null }] }} locale="en" me={null} />);
    fireEvent.click(screen.getByRole('button', { name: /Area/ }));
    expect(listener).toHaveBeenCalled();
    window.removeEventListener(OPEN_AREA_EVENT, listener);
  });
});

describe('banners', () => {
  it('app banner: the merchant text and store links; dismissing remembers it', () => {
    render(<AppBanner banner={layoutFixture('en').appBanner!} labels={{ region: 'Get our app', dismiss: 'Dismiss', android: 'Google Play', ios: 'App Store', huawei: 'AppGallery' }} />);
    expect(screen.getByText('Download App Now')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Google Play' })).toHaveAttribute('href', expect.stringContaining('play.google.com'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('app-banner')).toBeNull();
    expect(document.cookie).toContain(`${APP_BANNER_COOKIE}=dismissed`);
  });

  it('top and floating banners link through the Target; the floating one can be closed', () => {
    const banner = { id: 2001, image: { mobile: 'https://cdn.test/m.png', desktop: 'https://cdn.test/d.png', alt: null }, title: null, target: { type: 'deals' as const } };
    render(
      <>
        <TopBanner banner={banner} locale="ar" label="إعلان" />
        <FloatingBanner banner={{ ...banner, target: { type: 'landing_page', slug: 'summer-sale' } }} locale="ar" labels={{ region: 'عرض', dismiss: 'إغلاق العرض' }} />
      </>,
    );
    expect(within(screen.getByTestId('top-banner')).getByRole('link')).toHaveAttribute('href', '/ar/products/deals');
    expect(within(screen.getByTestId('floating-banner')).getByRole('link')).toHaveAttribute('href', '/ar/landing-page/summer-sale');
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق العرض' }));
    expect(screen.queryByTestId('floating-banner')).toBeNull();
    expect(document.cookie).toContain(`${FLOATING_BANNER_COOKIE}=2001`);
  });
});

describe('legal, USP, store status, maintenance', () => {
  it('legal links are the merchant pages', () => {
    render(<LegalLinks legal={layoutFixture('ar').legal} locale="ar" />);
    expect(screen.getByRole('link', { name: 'سياسة الخصوصية' })).toHaveAttribute('href', '/ar/privacy-policy');
    expect(screen.getByRole('link', { name: 'الشروط والأحكام' })).toHaveAttribute('href', '/ar/terms-and-conditions');
  });

  it('no legal links without pages', () => {
    const { container } = render(<LegalLinks legal={{ privacy: null, terms: null, cookies: null }} locale="en" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('USP strip in both languages', () => {
    const { unmount } = render(<UspStrip locale="en" />);
    expect(within(screen.getByTestId('usp-strip')).getAllByRole('listitem')).toHaveLength(4);
    unmount();
    render(<UspStrip locale="ar" />);
    expect(screen.getByText('توصيل سريع')).toBeInTheDocument();
  });

  it('store closed notice only when the store does not take orders', () => {
    const { container, rerender } = render(<StoreClosedNotice status={{ acceptingOrders: true, message: null }} locale="en" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<StoreClosedNotice status={{ acceptingOrders: false, message: 'Back tomorrow at 9 am.' }} locale="en" />);
    expect(screen.getByTestId('store-closed')).toHaveTextContent('Back tomorrow at 9 am.');
  });

  it('maintenance shows the merchant message', () => {
    render(<StoreUnavailable locale="ar" maintenance="نقوم بالتحديث — نعود قريباً" />);
    expect(screen.getByRole('heading', { name: 'سنعود قريبًا' })).toBeInTheDocument();
    expect(screen.getByText('نقوم بالتحديث — نعود قريباً')).toBeInTheDocument();
  });
});

describe('area chooser', () => {
  const selection = { required: true, label: 'Deliver to', prompt: 'Choose your Governorate and City to see what is available near you.' };

  it('opens by itself for a shopper with a session and no area, and saves the chosen area', async () => {
    const choose = vi.fn(async () => ({ ok: true as const }));
    render(<AreaChooser locale="en" selection={selection} me={{ authenticated: true, area: null }} locations={locationsFixture('en')} choose={choose} />);

    const dialog = screen.getByTestId('area-dialog');
    expect(within(dialog).getByText(selection.prompt)).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('area-city'), { target: { value: '1' } });
    fireEvent.change(screen.getByTestId('area-area'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(choose).toHaveBeenCalledWith('en', 12));
    await waitFor(() => expect(screen.queryByTestId('area-dialog')).toBeNull());
    expect(refresh).toHaveBeenCalled();
  });

  it('stays closed for visitors without a session; shows the current area; refusals stay in the dialog', async () => {
    const choose = vi.fn(async () => ({ ok: false as const, message: 'This area is not available. Please choose another one.' }));
    const { rerender } = render(<AreaChooser locale="en" selection={selection} me={{ authenticated: false }} locations={locationsFixture('en')} choose={choose} />);
    expect(screen.queryByTestId('area-dialog')).toBeNull();

    rerender(<AreaChooser locale="en" selection={selection} me={{ authenticated: true, area: { id: 12, name: 'Maadi', city: 'Cairo' } }} locations={locationsFixture('en')} choose={choose} />);
    expect(screen.getByTestId('area-open')).toHaveTextContent('Maadi, Cairo');
    act(() => {
      window.dispatchEvent(new Event(OPEN_AREA_EVENT));
    });
    fireEvent.change(screen.getByTestId('area-area'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('This area is not available. Please choose another one.'));
    expect(screen.getByTestId('area-dialog')).toBeInTheDocument();
  });
});

describe('mini cart', () => {
  function Opener() {
    return (
      <button type="button" onClick={useMiniCart().open}>
        open
      </button>
    );
  }

  it('shows the cart the API answered: lines, total, blockers, checkout gated by checkout.allowed', async () => {
    const cart = cartFixture('en');
    const readCart = vi.fn(async () => ({ status: 'ok' as const, cart }));
    render(
      <MiniCartProvider locale="en" readCart={readCart}>
        <Opener />
      </MiniCartProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    const drawer = await screen.findByTestId('mini-cart');
    await waitFor(() => expect(within(drawer).getAllByTestId('mini-cart-line')).toHaveLength(cart.items.length));
    expect(within(drawer).getByTestId('mini-cart-total')).toHaveTextContent(cart.summary.total.display);
    expect(within(drawer).getByTestId('checkout-blockers')).toBeInTheDocument();
    expect(within(drawer).getByTestId('mini-cart-checkout').tagName).toBe(cart.checkout.allowed ? 'A' : 'BUTTON');
    expect(within(drawer).getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/en/cart');

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close cart' }));
    expect(screen.queryByTestId('mini-cart')).toBeNull();
  });

  it('checkout is a link when the API allows it; empty and failed carts say so', async () => {
    const cart: Cart = { ...cartFixture('ar'), checkout: { ...cartFixture('ar').checkout, allowed: true, blockers: [] } };
    const answers = [{ status: 'ok' as const, cart }, { status: 'none' as const }, { status: 'error' as const }];
    render(
      <MiniCartProvider locale="ar" readCart={vi.fn(async () => answers.shift()!)}>
        <Opener />
      </MiniCartProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(screen.getByTestId('mini-cart-checkout')).toHaveAttribute('href', '/ar/checkout'));

    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(screen.getByText('سلتك فارغة.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'open' }));
    await waitFor(() => expect(screen.getByText('تعذر تحميل السلة.')).toBeInTheDocument());
  });
});
