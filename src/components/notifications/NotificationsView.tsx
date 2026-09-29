import Link from 'next/link';
import type { Locale, NotificationsPage } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { fill, formatCount, notificationsPageHref, type MarkAllReadAction, type MarkReadAction } from './helpers';
import { NotificationItem } from './NotificationItem';
import { NotificationsPagination } from './NotificationsPagination';
import { PendingButton } from './PendingButton';
import styles from './Notifications.module.css';

/**
 * What the page loaded:
 * - `ok`: the API answered (the list may be empty)
 * - `anonymous`: no shopper token, or the token was rejected (401) — nothing to show yet
 * - `error`: the API failed
 */
export type NotificationsResult = { status: 'ok'; data: NotificationsPage } | { status: 'anonymous' } | { status: 'error' };

interface NotificationsViewProps {
  result: NotificationsResult;
  locale: Locale;
  /** Request time, for "5 minutes ago" labels. */
  now: Date;
  timeZone?: string;
  markRead: MarkReadAction;
  markAllRead: MarkAllReadAction;
}

/** The notifications page body. Read state and unread count are the backend's; the UI only shows them. */
export function NotificationsView({ result, locale, now, timeZone, markRead, markAllRead }: NotificationsViewProps) {
  const t = translator(locale);
  const data = result.status === 'ok' ? result.data : null;
  const unread = data?.unreadCount ?? 0;
  const hasAny = Boolean(data && data.pagination.total > 0);
  const summary = unread ? fill(t('notificationsUnreadCount'), { count: formatCount(unread, locale) }) : t('notificationsAllRead');

  return (
    <div className={`container ${styles.page}`} data-testid="notifications">
      <header className={styles.header}>
        <div className={styles.headingGroup}>
          <h1 className={styles.heading}>{t('notificationsTitle')}</h1>
          {hasAny && (
            <p className={styles.summary} data-testid="notifications-unread">
              {summary}
            </p>
          )}
        </div>
        {unread > 0 && (
          <form action={markAllRead.bind(null, locale)}>
            <PendingButton className={styles.markAll}>{t('notificationsMarkAllRead')}</PendingButton>
          </form>
        )}
      </header>

      {result.status === 'error' ? (
        <div className={styles.state} role="alert">
          <h2 className={styles.stateTitle}>{t('notificationsErrorTitle')}</h2>
          <p className={styles.stateText}>{t('notificationsErrorText')}</p>
          <Link href={notificationsPageHref(locale, 1)} className={styles.stateButton}>
            {t('notificationsRetry')}
          </Link>
        </div>
      ) : data && data.items.length > 0 ? (
        <ul className={styles.list}>
          {data.items.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              locale={locale}
              now={now}
              timeZone={timeZone}
              markRead={markRead.bind(null, locale, notification.id)}
            />
          ))}
        </ul>
      ) : (
        <div className={styles.state} data-testid="notifications-empty">
          <h2 className={styles.stateTitle}>{t('notificationsEmptyTitle')}</h2>
          <p className={styles.stateText}>{t('notificationsEmptyText')}</p>
          <Link href={routes.home(locale)} className={styles.stateButton}>
            {t('notificationsEmptyCta')}
          </Link>
        </div>
      )}

      {data && <NotificationsPagination pagination={data.pagination} locale={locale} />}
    </div>
  );
}
