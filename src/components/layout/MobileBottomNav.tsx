'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Locale, Me, MobileNav, MobileNavItem } from '@/sdk';
import { translator } from '@/lib/i18n';
import { navAction, navBadge } from '@/lib/mobile-nav';
import { formatNumber } from '@/lib/numbers';
import { routes } from '@/lib/routing';
import { OPEN_AREA_EVENT } from '@/lib/shell';
import { Icon } from '../ui/Icon';
import { LocaleLink } from './LanguageSwitch';
import { NavIcon } from './NavIcon';
import { useShopperMe } from '../shopper/ShopperStateProvider';
import styles from './MobileBottomNav.module.css';

interface MobileBottomNavProps {
  nav: MobileNav;
  locale: Locale;
  /** Badges come from `Me.counts`; null → no badges. */
  me: Pick<Me, 'counts' | 'authenticated' | 'isGuest'> | null;
}

/**
 * The phone's bottom bar and its "more" sheet, exactly as `Layout.mobileNav` describes them (items,
 * order, labels, icons, badges). Hidden from tablet width up (CSS).
 */
export function MobileBottomNav({ nav, locale, me: rendered }: MobileBottomNavProps) {
  // Inside ShopperStateProvider: its latest `GET /me` (updated right after add to cart).
  const me = useShopperMe(rendered);
  const t = translator(locale);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname() ?? routes.home(locale);

  if (!nav.items.length) return null;
  return (
    <>
      <nav className={styles.bar} aria-label={t('mobileNavLabel')} data-testid="mobile-bottom-nav">
        <ul className={styles.items}>
          {nav.items.map((item) => (
            <li key={item.id} className={styles.cell}>
              <NavEntry item={item} locale={locale} me={me} pathname={pathname} onMore={() => setMoreOpen(true)} className={styles.item} />
            </li>
          ))}
        </ul>
      </nav>
      {moreOpen && <MoreSheet nav={nav} locale={locale} me={me} pathname={pathname} onClose={() => setMoreOpen(false)} />}
    </>
  );
}

interface NavEntryProps {
  item: MobileNavItem;
  locale: Locale;
  me: MobileBottomNavProps['me'];
  pathname: string;
  onMore: () => void;
  className: string;
  onNavigate?: () => void;
}

function NavEntry({ item, locale, me, pathname, onMore, className, onNavigate }: NavEntryProps) {
  const action = navAction(item, locale);
  const badge = navBadge(item, me);
  const content = (
    <>
      <span className={styles.iconWrap}>
        <NavIcon icon={item.icon} />
        {badge !== null && (
          <span className={styles.badge} data-testid={`nav-badge-${item.id}`}>
            {formatNumber(badge, locale)}
          </span>
        )}
      </span>
      <span className={styles.label}>{item.label}</span>
    </>
  );

  switch (action.kind) {
    case 'link': {
      if (action.link.external) {
        return (
          <a href={action.link.href} className={className} target="_blank" rel="noopener noreferrer" onClick={onNavigate} data-nav={item.id}>
            {content}
          </a>
        );
      }
      const current = pathname === action.link.href;
      return (
        <Link href={action.link.href} className={className} aria-current={current ? 'page' : undefined} onClick={onNavigate} data-nav={item.id}>
          {content}
        </Link>
      );
    }
    case 'more':
      return (
        <button type="button" className={className} onClick={onMore} aria-haspopup="dialog" data-nav={item.id}>
          {content}
        </button>
      );
    case 'area':
      return (
        <button
          type="button"
          className={className}
          onClick={() => {
            onNavigate?.();
            window.dispatchEvent(new Event(OPEN_AREA_EVENT));
          }}
          data-nav={item.id}
        >
          {content}
        </button>
      );
    case 'language':
      return (
        <LocaleLink locale={locale} className={className} onClick={onNavigate} data-nav={item.id}>
          {content}
        </LocaleLink>
      );
    default:
      return null;
  }
}

function MoreSheet({ nav, locale, me, pathname, onClose }: { nav: MobileNav; locale: Locale; me: MobileBottomNavProps['me']; pathname: string; onClose: () => void }) {
  const t = translator(locale);
  const sheet = useRef<HTMLDivElement>(null);
  const signedOut = !me?.authenticated || me.isGuest;

  // Focus the sheet and let Escape close it (keyboard users).
  useEffect(() => {
    sheet.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={sheet} className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="more-sheet-title" tabIndex={-1} data-testid="more-sheet">
        <div className={styles.sheetHead}>
          <h2 id="more-sheet-title" className={styles.sheetTitle}>
            {nav.more.title}
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label={t('mobileNavMoreClose')}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {signedOut && (nav.more.welcomeTitle || nav.more.welcomeText) && (
          <div className={styles.welcome}>
            {nav.more.welcomeTitle && <p className={styles.welcomeTitle}>{nav.more.welcomeTitle}</p>}
            {nav.more.welcomeText && <p className={styles.welcomeText}>{nav.more.welcomeText}</p>}
            <Link href={routes.signIn(locale, pathname)} className={styles.signIn} onClick={onClose}>
              {t('mobileNavSignIn')}
            </Link>
          </div>
        )}
        <ul className={styles.sheetItems}>
          {nav.more.items.map((item) => (
            <li key={item.id}>
              <NavEntry item={item} locale={locale} me={me} pathname={pathname} onMore={onClose} className={styles.sheetItem} onNavigate={onClose} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
