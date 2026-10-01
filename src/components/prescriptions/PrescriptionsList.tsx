import type { CancellationReason, Locale, PrescriptionsPage } from '@/sdk';
import type { CancelOrderAction } from '@/components/account/types';
import { Pagination } from '@/components/ui/Pagination';
import { formatDate } from '@/lib/dates';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { routes } from '@/lib/routing';
import { CancelPrescription } from './CancelPrescription';
import styles from './Prescriptions.module.css';

interface PrescriptionsListProps {
  locale: Locale;
  page: PrescriptionsPage;
  reasons: CancellationReason[] | null;
  cancelAction: CancelOrderAction;
  timeZone?: string;
}

/** The customer's prescriptions as the API sent them; "cancel" only where `actions.canCancel`. */
export function PrescriptionsList({ locale, page, reasons, cancelAction, timeZone }: PrescriptionsListProps) {
  const t = translator(locale);
  if (page.items.length === 0) {
    return (
      <p className={styles.empty} data-testid="prescriptions-empty">
        {t('prescriptionsEmpty')}
      </p>
    );
  }
  return (
    <>
      <ul className={styles.list} data-testid="prescriptions">
        {page.items.map((item) => (
          <li key={item.id} className={styles.item} data-testid="prescription" data-id={item.id}>
            <div className={styles.itemHead}>
              <strong>{item.reference}</strong>
              <span className={styles.status} data-status={item.status.code} data-testid="prescription-status">
                {item.status.label}
              </span>
            </div>
            <dl className={styles.facts}>
              <div>
                <dt>{t('prescriptionsSentOn')}</dt>
                <dd>
                  <time dateTime={item.placedAt}>{formatDate(item.placedAt, locale, { timeZone })}</time>
                </dd>
              </div>
              {item.type && (
                <div>
                  <dt>{t('prescriptionsType')}</dt>
                  <dd>{item.type}</dd>
                </div>
              )}
              {item.prescriptionNumber && (
                <div>
                  <dt>{t('prescriptionsNumber')}</dt>
                  <dd>{item.prescriptionNumber}</dd>
                </div>
              )}
              {item.note && (
                <div>
                  <dt>{t('prescriptionsNote')}</dt>
                  <dd>{item.note}</dd>
                </div>
              )}
              {item.address && (
                <div>
                  <dt>{t('prescriptionsAddressLabel')}</dt>
                  <dd>{item.address}</dd>
                </div>
              )}
            </dl>
            <p className={styles.muted}>{t('prescriptionsFiles').replace('{count}', formatNumber(item.fileCount, locale))}</p>
            {item.cancellation?.reason && (
              <p className={styles.muted} data-testid="prescription-cancellation">
                {t('prescriptionsCancelledBecause').replace('{reason}', item.cancellation.reason)}
              </p>
            )}
            {item.actions.canCancel && <CancelPrescription locale={locale} prescriptionId={item.id} reasons={reasons} cancelAction={cancelAction} />}
          </li>
        ))}
      </ul>
      <Pagination
        pagination={page.pagination}
        baseHref={routes.prescriptions(locale)}
        hrefFor={(n) => routes.prescriptions(locale, n)}
        locale={locale}
        labels={{ nav: t('prescriptionsPages'), previous: t('previous'), next: t('next'), page: t('ordersPage') }}
      />
    </>
  );
}
