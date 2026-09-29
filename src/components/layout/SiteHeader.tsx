import Link from 'next/link';
import type { Layout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { DesktopNav } from './DesktopNav';
import { MobileMenu } from './MobileMenu';
import styles from './SiteHeader.module.css';

export function SiteHeader({ layout, locale }: { layout: Layout; locale: Locale }) {
  const t = translator(locale);
  const { store, header, navigation, features } = layout;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <MobileMenu layout={layout} locale={locale} labels={{ open: t('menu'), close: t('closeMenu'), language: t('language'), languageLabel: t('languageLabel') }} />

        <Link href={routes.home(locale)} className={styles.logo} aria-label={store.name ?? 'Home'}>
          {store.logo ? (
            // eslint-disable-next-line @next/next/no-img-element -- merchant logo from any CDN
            <img src={store.logo} alt={store.name ?? ''} className={styles.logoImage} />
          ) : (
            <span className={styles.logoText}>{store.name}</span>
          )}
        </Link>

        <div className={styles.actions}>
          <form action={routes.search(locale)} method="get" role="search" className={styles.search}>
            <label htmlFor="site-search" className="visually-hidden">
              {t('search')}
            </label>
            <input id="site-search" name="q" type="search" placeholder={header.searchPlaceholder ?? t('searchPlaceholder')} className={styles.searchInput} />
            <button type="submit" className={styles.searchButton} aria-label={t('search')}>
              <Icon name="search" size={20} />
            </button>
          </form>

          {header.shortcuts.map((shortcut) => (
            <TargetLink key={shortcut.label} target={shortcut.target} locale={locale} className={styles.shortcut}>
              {shortcut.label}
            </TargetLink>
          ))}

          <Link href={routes.account(locale)} className={styles.icon} aria-label={t('account')}>
            <Icon name="user" />
          </Link>
          {features.wishlist && (
            <Link href={routes.wishlist(locale)} className={styles.icon} aria-label={t('wishlist')}>
              <Icon name="heart" />
            </Link>
          )}
          <Link href={routes.cart(locale)} className={styles.icon} aria-label={t('cart')}>
            <Icon name="bag" />
          </Link>
        </div>
      </div>
      <div className={styles.navRow}>
        <div className="container">
          <DesktopNav items={navigation} locale={locale} />
        </div>
      </div>
    </header>
  );
}
