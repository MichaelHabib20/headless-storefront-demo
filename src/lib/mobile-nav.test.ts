import { describe, expect, it } from 'vitest';
import type { MobileNavItem } from '@/sdk';
import { layoutFixture, meFixture } from '@/test/fixtures';
import { navAction, navBadge } from './mobile-nav';
import { areaChooserForced, floatingBannerDismissed } from './shell';

const item = (id: string, target: MobileNavItem['target'] = null, badge: MobileNavItem['badge'] = null): MobileNavItem => ({ id, label: id, icon: null, target, badge });

describe('bottom nav actions', () => {
  it('follows the Target when the API sends one', () => {
    expect(navAction(item('deals', { type: 'deals' }), 'ar')).toEqual({ kind: 'link', link: { href: '/ar/deals', external: false } });
    expect(navAction(item('menu_button_1', { type: 'page', slug: 'branches' }), 'en')).toEqual({ kind: 'link', link: { href: '/en/pages/branches', external: false } });
  });

  it('maps the ids of our own pages and actions', () => {
    expect(navAction(item('cart'), 'en')).toEqual({ kind: 'link', link: { href: '/en/cart', external: false } });
    expect(navAction(item('categories'), 'ar')).toEqual({ kind: 'link', link: { href: '/ar/categories', external: false } });
    expect(navAction(item('orders'), 'en')).toMatchObject({ link: { href: '/en/account/orders' } });
    expect(navAction(item('points'), 'ar')).toEqual({ kind: 'link', link: { href: '/ar/account/your-points', external: false } });
    expect(navAction(item('more'), 'en')).toEqual({ kind: 'more' });
    expect(navAction(item('area'), 'en')).toEqual({ kind: 'area' });
    expect(navAction(item('language'), 'en')).toEqual({ kind: 'language' });
  });

  it('skips ids it does not know', () => {
    expect(navAction(item('wallet'), 'en')).toEqual({ kind: 'none' });
  });

  it('badges come from Me.counts', () => {
    const me = meFixture('en');
    expect(navBadge(item('cart', null, 'cart'), me)).toBe(me.counts.cart);
    expect(navBadge(item('notifications', null, 'notifications'), me)).toBe(me.counts.unreadNotifications || null);
    expect(navBadge(item('home'), me)).toBeNull();
    expect(navBadge(item('cart', null, 'cart'), null)).toBeNull();
    expect(navBadge(item('cart', null, 'cart'), { counts: { cart: 0, wishlist: 0, compare: 0, unreadNotifications: 0 } })).toBeNull();
  });

  it('every item of the recorded layout does something', () => {
    for (const locale of ['en', 'ar'] as const) {
      const nav = layoutFixture(locale).mobileNav!;
      for (const entry of [...nav.items, ...nav.more.items]) expect(navAction(entry, locale).kind).not.toBe('none');
    }
  });
});

describe('shell rules', () => {
  it('the area chooser opens by itself only for a shopper with a session and no area', () => {
    expect(areaChooserForced(true, { authenticated: true, area: null })).toBe(true);
    expect(areaChooserForced(true, { authenticated: true })).toBe(true);
    expect(areaChooserForced(true, { authenticated: true, area: { id: 1, name: 'Maadi', city: 'Cairo' } })).toBe(false);
    expect(areaChooserForced(true, { authenticated: false, area: null })).toBe(false);
    expect(areaChooserForced(true, null)).toBe(false);
    expect(areaChooserForced(false, { authenticated: true, area: null })).toBe(false);
  });

  it('a dismissed floating banner stays hidden until the merchant shows another one', () => {
    expect(floatingBannerDismissed('2001', 2001)).toBe(true);
    expect(floatingBannerDismissed('2001', 2002)).toBe(false);
    expect(floatingBannerDismissed(undefined, 2001)).toBe(false);
  });
});
