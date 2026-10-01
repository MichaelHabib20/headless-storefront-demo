import Link from 'next/link';
import type { Locale, LoyaltyHistoryPage } from '@/sdk';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Loyalty.module.css';

/** Earned, pending, used and expired points, newest first, as the backend wrote them. */
export function PointsHistory({ locale, page, timeZone }: { locale: Locale; page: LoyaltyHistoryPage; timeZone?: string }) {
  const t = translator(locale);
  if (page.items.length === 0) {
    return (
      <p className={styles.muted} data-testid="history-empty">
        {t('loyaltyHistoryEmpty')}
      </p>
    );
  }
  return (
    <>
      <ul className={styles.history} data-testid="history">
        {page.items.map((entry) => (
          <li key={entry.id} className={styles.entry} data-testid="history-entry" data-kind={entry.kind}>
            <div>
              <p className={styles.entryTitle}>{entry.title}</p>
              {entry.detail && <p className={styles.muted}>{entry.detail}</p>}
              <time dateTime={entry.date} className={styles.muted}>
                {formatDate(entry.date, locale, { timeZone })}
              </time>
              {entry.orderId && (
                <Link href={routes.order(locale, entry.orderId)} className={styles.link}>
                  {t('loyaltyViewOrder')}
                </Link>
              )}
            </div>
            <strong className={styles.entryPoints} data-kind={entry.kind}>
              <bdi>{entry.points.text}</bdi>
            </strong>
          </li>
        ))}
      </ul>
      <Pagination
        pagination={page.pagination}
        baseHref={routes.pointsHistory(locale)}
        hrefFor={(n) => routes.pointsHistory(locale, n)}
        locale={locale}
        labels={{ nav: t('loyaltyHistoryPages'), previous: t('previous'), next: t('next'), page: t('ordersPage') }}
      />
    </>
  );
}
