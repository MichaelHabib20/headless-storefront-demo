import type { Locale, Notification } from '@/sdk';
import { translator } from '@/lib/i18n';
import { TargetLink } from '../ui/TargetLink';
import { formatNotificationDate, type BoundAction } from './helpers';
import { OpenMarksRead } from './OpenMarksRead';
import { PendingButton } from './PendingButton';
import styles from './Notifications.module.css';

interface NotificationItemProps {
  notification: Notification;
  locale: Locale;
  now: Date;
  timeZone?: string;
  /** Marks THIS notification as read (bound server action). */
  markRead: BoundAction;
}

/**
 * One notification. `read` is the backend's answer for this shopper; the item is linked
 * with <TargetLink> when it has a target. Opening the link marks it read.
 */
export function NotificationItem({ notification, locale, now, timeZone, markRead }: NotificationItemProps) {
  const t = translator(locale);
  const unread = !notification.read;
  const date = formatNotificationDate(notification.createdAt, locale, { now, timeZone });
  const titleId = `notification-${notification.id}-title`;

  return (
    <li className={styles.item} data-testid="notification" data-read={notification.read ? 'true' : 'false'}>
      <OpenMarksRead onOpen={unread ? markRead : undefined} className={styles.main}>
        <TargetLink target={notification.target} locale={locale} className={styles.link}>
          {notification.image && (
            // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
            <img src={notification.image} alt="" loading="lazy" decoding="async" className={styles.image} />
          )}
          <span className={styles.text}>
            <span className={styles.titleRow}>
              {unread && <span className={styles.dot} aria-hidden="true" />}
              <span id={titleId} className={styles.title}>{notification.title}</span>
              {unread && <span className="visually-hidden">{t('notificationsUnread')}</span>}
            </span>
            {notification.body && <span className={styles.body}>{notification.body}</span>}
            <time dateTime={notification.createdAt} title={date.absolute} className={styles.time}>
              {date.label}
            </time>
          </span>
        </TargetLink>
      </OpenMarksRead>
      {unread && (
        <form action={markRead} className={styles.itemAction}>
          <PendingButton className={styles.markRead} aria-describedby={titleId}>
            {t('notificationsMarkRead')}
          </PendingButton>
        </form>
      )}
    </li>
  );
}
