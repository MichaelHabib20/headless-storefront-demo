import Link from 'next/link';
import type { Locale, Pagination } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Icon } from '../ui/Icon';
import { fill, formatCount, notificationsPageHref } from './helpers';
import styles from './Notifications.module.css';

/**
 * Previous / next links for the notifications list, driven by the API's `pagination`.
 * Local to this page on purpose (a shared Pagination component is built elsewhere).
 */
export function NotificationsPagination({ pagination, locale }: { pagination: Pagination; locale: Locale }) {
  const t = translator(locale);
  const { page, totalPages } = pagination;
  if (totalPages <= 1 && page <= 1) return null;

  // Past the last page (stale link): "previous" goes back to the last page that exists.
  const previous = page > 1 ? Math.min(page - 1, Math.max(totalPages, 1)) : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav aria-label={t('notificationsPagination')} className={styles.pagination} data-testid="notifications-pagination">
      {previous ? (
        <Link href={notificationsPageHref(locale, previous)} rel="prev" className={styles.pageLink}>
          <Icon name="arrow" size={16} className={styles.backIcon} />
          {t('notificationsPrevious')}
        </Link>
      ) : (
        <span />
      )}
      <span className={styles.pageStatus}>
        {fill(t('notificationsPageOf'), { page: formatCount(page, locale), total: formatCount(Math.max(totalPages, 1), locale) })}
      </span>
      {next ? (
        <Link href={notificationsPageHref(locale, next)} rel="next" className={styles.pageLink}>
          {t('notificationsNext')}
          <Icon name="arrow" size={16} directional />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
