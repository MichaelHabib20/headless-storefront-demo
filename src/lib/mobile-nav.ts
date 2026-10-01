import type { Locale, Me, MobileNavItem } from '@/sdk';
import { resolveTarget, routes, type ResolvedLink } from './routing';

/**
 * What a bottom-nav item does. The items, their order, labels and icons are the API's
 * (`Layout.mobileNav`, already filtered by the store's features); here only the storefront's own
 * pages are looked up for items without a Target, by their id.
 *
 * - `link`: go somewhere (the item's Target, or one of our own pages)
 * - `more`: open the "more" sheet
 * - `area`: open the area chooser
 * - `language`: switch the page to the other language
 * - `none`: an id this storefront doesn't know yet → the item is skipped
 */
export type NavAction = { kind: 'link'; link: ResolvedLink } | { kind: 'more' } | { kind: 'area' } | { kind: 'language' } | { kind: 'none' };

/** Our own pages for the item ids that carry no Target (see the contract's `MobileNavItem.id`). */
const OWN_PAGES: Partial<Record<string, (locale: Locale) => string>> = {
  categories: routes.categories,
  cart: routes.cart,
  wishlist: routes.wishlist,
  compare: routes.compare,
  orders: routes.orders,
  notifications: routes.notifications,
  account: routes.account,
};

export function navAction(item: MobileNavItem, locale: Locale): NavAction {
  const link = resolveTarget(item.target, locale);
  if (link) return { kind: 'link', link };
  if (item.id === 'more' || item.id === 'area' || item.id === 'language') return { kind: item.id };
  const own = OWN_PAGES[item.id];
  return own ? { kind: 'link', link: { href: own(locale), external: false } } : { kind: 'none' };
}

/** The `Me.counts` value an item's badge shows (null: no badge, or nothing to count). */
export function navBadge(item: MobileNavItem, me: Pick<Me, 'counts'> | null): number | null {
  if (!item.badge || !me) return null;
  const counts = me.counts;
  const value = item.badge === 'notifications' ? counts.unreadNotifications : counts[item.badge];
  return value > 0 ? value : null;
}
