import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../ui/Icon';
import styles from './Account.module.css';

interface AccountPageProps {
  title: string;
  /** A link above the title (back to the list, back to checkout). */
  back?: { href: string; label: string } | null;
  /** The page's main link next to the title (e.g. "Add a new address"). */
  action?: { href: string; label: string } | null;
  testId?: string;
  children: ReactNode;
}

/** Frame of the account pages: title, optional back link and main action, then the content. */
export function AccountPage({ title, back, action, testId, children }: AccountPageProps) {
  return (
    <div className={`container ${styles.page}`} data-testid={testId}>
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          {back && (
            <Link href={back.href} className={styles.back}>
              <Icon name="chevron" size={16} className={styles.backIcon} />
              {back.label}
            </Link>
          )}
          <h1 className={styles.title}>{title}</h1>
        </div>
        {action && (
          <Link href={action.href} className={styles.primary}>
            {action.label}
          </Link>
        )}
      </header>
      {children}
    </div>
  );
}
