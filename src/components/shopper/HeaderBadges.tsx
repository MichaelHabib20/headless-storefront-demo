import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Layout, Locale, Me } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import { badgeText, countLabel } from './labels';
import { ShopperIcon } from './ShopperIcon';
import styles from './HeaderBadges.module.css';

interface HeaderBadgesProps {
  locale: Locale;
  /** `GET /me` for this request; null when it could not be loaded (icons render without badges). */
  me: Me | null | undefined;
  features: Pick<Layout['features'], 'wishlist' | 'compare' | 'notifications'>;
}

/** Header icons with the shopper's counts from `GET /me`. Entry points follow `layout.features`. */
export function HeaderBadges({ locale, me, features }: HeaderBadgesProps) {
  const t = translator(locale);
  const counts = me?.counts;

  return (
    <>
      {features.notifications && (
        <BadgeLink
          href={routes.notifications(locale)}
          locale={locale}
          plain={true}
          count={counts?.unreadNotifications}
          label={countLabel(locale, counts?.unreadNotifications, {
            none: t('headerNotifications'),
            one: t('headerNotificationsCountOne'),
            other: t('headerNotificationsCount'),
          })}
        >
          <ShopperIcon name="bell" />
        </BadgeLink>
      )}
      {features.compare && (
        <BadgeLink
          href={routes.compare(locale)}
          locale={locale}
          count={counts?.compare}
          label={countLabel(locale, counts?.compare, { none: t('headerCompare'), one: t('headerCompareCountOne'), other: t('headerCompareCount') })}
        >
          <ShopperIcon name="compare" />
        </BadgeLink>
      )}
      {features.wishlist && (
        <BadgeLink
          href={routes.wishlist(locale)}
          locale={locale}
          count={counts?.wishlist}
          label={countLabel(locale, counts?.wishlist, { none: t('wishlist'), one: t('headerWishlistCountOne'), other: t('headerWishlistCount') })}
        >
          <Icon name="heart" />
        </BadgeLink>
      )}
      <BadgeLink
        href={routes.cart(locale)}
        locale={locale}
        count={counts?.cart}
        label={countLabel(locale, counts?.cart, { none: t('cart'), one: t('headerCartCountOne'), other: t('headerCartCount') })}
      >
        <Icon name="bag" />
      </BadgeLink>
    </>
  );
}

interface BadgeLinkProps {
  href: string;
  label: string;
  count: number | undefined;
  locale: Locale;
  /** Icon without the coloured circle. */
  plain?: boolean;
  children: ReactNode;
}

function BadgeLink({ href, label, count, locale, plain, children }: BadgeLinkProps) {
  return (
    <Link href={href} className={plain ? `${styles.link} ${styles.plain}` : styles.link} aria-label={label}>
      {children}
      {count ? (
        <span className={styles.badge} aria-hidden="true">
          {badgeText(count, locale)}
        </span>
      ) : null}
    </Link>
  );
}
