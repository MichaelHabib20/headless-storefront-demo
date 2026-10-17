import Link from 'next/link';
import { Icon } from '../ui/Icon';
import styles from './AccountLinks.module.css';

/** Material-style drawings (24×24) of the old storefront's account menu icons. */
const ICONS = {
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Z',
  history: 'M13 3a9 9 0 0 0-9 9H1l3.9 3.9L9 12H6a7 7 0 1 1 2.1 5l-1.4 1.4A9 9 0 1 0 13 3Zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8H12Z',
  location: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z',
  notifications: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Zm6-6V11c0-3.1-1.6-5.6-4.5-6.3V4a1.5 1.5 0 0 0-3 0v.7C7.6 5.4 6 7.9 6 11v5l-2 2v1h16v-1l-2-2Z',
  points: 'm12 17.3 6.2 3.7-1.6-7 5.4-4.7-7.2-.6L12 2 9.2 8.7 2 9.3l5.4 4.7-1.6 7 6.2-3.7Z',
  wallet: 'M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9Zm-9-2h10V8H12v8Zm4-2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  voucher: 'M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .6.2 1.1.6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM6.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
  insurance: 'M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4Zm1 15h-2v-3H8v-2h3V8h2v3h3v2h-3v3Z',
  bank: 'M4 10v7h3v-7H4Zm6 0v7h3v-7h-3ZM2 22h19v-3H2v3Zm14-12v7h3v-7h-3ZM11.5 1 2 6v2h19V6l-9.5-5Z',
  lock: 'M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2Zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4Zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2Z',
} as const;

/** Which account page a link opens: it picks the icon. */
export type AccountLinkKind = keyof typeof ICONS;

export interface AccountLink {
  href: string;
  label: string;
  kind: AccountLinkKind;
}

/**
 * The account's menu like the old storefront's (icon + label rows): one column on a phone, a grid of
 * cards from tablet width. Logical CSS, the chevron turns in right-to-left pages.
 */
export function AccountLinks({ label, links }: { label: string; links: readonly AccountLink[] }) {
  return (
    <nav aria-label={label} data-testid="account-links" className={styles.nav}>
      <ul className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link}>
              <svg className={styles.icon} width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
                <path d={ICONS[link.kind]} />
              </svg>
              <span className={styles.label}>{link.label}</span>
              <Icon name="chevron" size={18} directional className={styles.chevron} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
