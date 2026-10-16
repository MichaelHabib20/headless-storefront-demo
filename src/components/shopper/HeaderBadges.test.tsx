/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Me } from '@/sdk';
import { anonymousMeFixture, layoutFixture, meFixture } from '@/test/fixtures';
import { SiteHeader } from '../layout/SiteHeader';
import { HeaderBadges } from './HeaderBadges';

const allOn = { wishlist: true, compare: true, notifications: true };

function withCounts(counts: Partial<Me['counts']>): Me {
  const me = meFixture('en');
  return { ...me, counts: { ...me.counts, ...counts } };
}

describe('header badges', () => {
  it('shows the signed-in shopper counts with accessible labels', () => {
    render(<HeaderBadges locale="en" me={meFixture('en')} features={allOn} />);

    const cart = screen.getByRole('link', { name: 'Cart, 2 items' });
    expect(cart).toHaveAttribute('href', '/en/cart');
    expect(cart).toHaveTextContent('2');
    expect(screen.getByRole('link', { name: 'Wishlist, 3 items' })).toHaveAttribute('href', '/en/favorites');
    expect(screen.getByRole('link', { name: 'Compare, 2 products' })).toHaveAttribute('href', '/en/compare');
    const notifications = screen.getByRole('link', { name: 'Notifications, 24 unread' });
    expect(notifications).toHaveAttribute('href', '/en/notifications');
    expect(notifications).toHaveTextContent('24');
  });

  it('uses the singular for one', () => {
    render(<HeaderBadges locale="en" me={withCounts({ cart: 1, wishlist: 1, compare: 1, unreadNotifications: 1 })} features={allOn} />);
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wishlist, 1 item' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compare, 1 product' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  });

  it('shows plain icons without badges for an anonymous visitor', () => {
    render(<HeaderBadges locale="en" me={anonymousMeFixture()} features={allOn} />);
    for (const name of ['Cart', 'Wishlist', 'Compare', 'Notifications']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveTextContent('');
    }
  });

  it('renders without badges when Me could not be loaded', () => {
    const { container } = render(<HeaderBadges locale="en" me={null} features={allOn} />);
    expect(screen.getByRole('link', { name: 'Cart' })).toHaveAttribute('href', '/en/cart');
    expect(container.querySelectorAll('.badge')).toHaveLength(0);
  });

  it('caps big numbers in the badge, not in the label', () => {
    render(<HeaderBadges locale="en" me={withCounts({ unreadNotifications: 150 })} features={allOn} />);
    expect(screen.getByRole('link', { name: 'Notifications, 150 unread' })).toHaveTextContent('99+');
  });

  it('hides compare, notifications and wishlist when the store switched them off', () => {
    render(<HeaderBadges locale="en" me={meFixture('en')} features={{ wishlist: false, compare: false, notifications: false }} />);
    expect(screen.queryByRole('link', { name: /Compare/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Notifications/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Wishlist/ })).toBeNull();
    expect(screen.getByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();
  });

  it('labels the icons in Arabic', () => {
    render(<HeaderBadges locale="ar" me={meFixture('ar')} features={allOn} />);
    expect(screen.getByRole('link', { name: 'السلة، عدد المنتجات: 2' })).toHaveAttribute('href', '/ar/cart');
    expect(screen.getByRole('link', { name: 'المفضلة، عدد المنتجات: 3' })).toHaveAttribute('href', '/ar/favorites');
    expect(screen.getByRole('link', { name: 'المقارنة، عدد المنتجات: 2' })).toHaveAttribute('href', '/ar/compare');
    expect(screen.getByRole('link', { name: 'الإشعارات، غير المقروءة: 24' })).toHaveAttribute('href', '/ar/notifications');
  });

  it('is part of the site header, gated by layout.features', () => {
    const layout = layoutFixture('en');
    layout.features.compare = false;
    // The real menu is large: query the header directly instead of by role.
    const { container } = render(<SiteHeader layout={layout} locale="en" me={meFixture('en')} />);

    expect(container.querySelector('a[href="/en/cart"]')).toHaveAttribute('aria-label', 'Cart, 2 items');
    expect(container.querySelector('a[href="/en/favorites"]')).toHaveAttribute('aria-label', 'Wishlist, 3 items');
    expect(container.querySelector('a[href="/en/notifications"]')).toHaveAttribute('aria-label', 'Notifications, 24 unread');
    expect(container.querySelector('a[href="/en/compare"]')).toBeNull();
    expect(container.querySelector('a[href="/en/account"]')).toHaveAttribute('aria-label', 'Account');
  });
});
