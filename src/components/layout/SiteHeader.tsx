import Link from 'next/link';
import type { Layout, Locale, Me } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { HeaderBadges } from '../shopper/HeaderBadges';
import { Icon } from '../ui/Icon';
import { TargetLink } from '../ui/TargetLink';
import { DesktopNav } from './DesktopNav';
import { MobileMenu } from './MobileMenu';
import styles from './SiteHeader.module.css';

interface SiteHeaderProps {
  layout: Layout;
  locale: Locale;
  /** The shopper's `GET /me` for the header counts. Missing/null → icons without badges. */
  me?: Me | null;
}

export function SiteHeader({ layout, locale, me = null }: SiteHeaderProps) {
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
          <HeaderBadges locale={locale} me={me} features={features} />
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
