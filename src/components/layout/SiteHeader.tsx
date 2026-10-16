import Link from 'next/link';
import type { Layout, Locale, Me } from '@/sdk';
import { searchSuggestionsAction } from '@/lib/catalog.actions';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { HeaderBadges } from '../shopper/HeaderBadges';
import { TargetLink } from '../ui/TargetLink';
import { AccountMenu } from './AccountMenu';
import { DesktopNav } from './DesktopNav';
import { MobileMenu } from './MobileMenu';
import { SearchBox } from './SearchBox';
import { StoreLogo } from './StoreLogo';
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
          <StoreLogo src={store.logo} name={store.name} imageClassName={styles.logoImage} textClassName={styles.logoText} />
        </Link>

        <SearchBox
          locale={locale}
          suggest={searchSuggestionsAction}
          className={styles.search}
          labels={{
            search: t('search'),
            placeholder: header.searchPlaceholder ?? t('searchPlaceholder'),
            suggestions: t('catalogSuggestions'),
            count: t('catalogSuggestionsCount'),
            none: t('catalogNoSuggestions'),
            viewAll: t('catalogViewAllFor'),
          }}
        />

        <div className={styles.actions}>
          {header.shortcuts.map((shortcut) => (
            <TargetLink key={shortcut.label} target={shortcut.target} locale={locale} className={styles.shortcut}>
              {shortcut.label}
            </TargetLink>
          ))}

          <HeaderBadges locale={locale} me={me} features={features} />
          <AccountMenu locale={locale} me={me} features={features} />
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
