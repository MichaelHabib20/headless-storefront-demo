import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import styles from './Account.module.css';

interface TrackOrderFormProps {
  locale: Locale;
  /** What the shopper typed (kept in the inputs after a search). */
  values: { number: string; phone: string } | null;
  /** The backend found no order for this pair (or the store has tracking off). */
  notFound?: boolean;
}

/** A plain GET form: the search is a read of `GET /orders/track`, so it works without JavaScript. */
export function TrackOrderForm({ locale, values, notFound }: TrackOrderFormProps) {
  const t = translator(locale);
  return (
    <form method="get" action={routes.trackOrder(locale)} className={styles.form} data-testid="track-order-form">
      <p className={styles.panelText}>{t('trackIntro')}</p>
      {notFound && (
        <p className={styles.error} role="alert" data-testid="track-order-not-found">
          {t('trackNotFound')}
        </p>
      )}
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="track-number" className={styles.label}>
            {t('trackNumber')}
          </label>
          <input id="track-number" name="number" className={styles.input} required maxLength={32} inputMode="numeric" defaultValue={values?.number ?? ''} />
        </div>
        <div className={styles.field}>
          <label htmlFor="track-phone" className={styles.label}>
            {t('trackPhone')}
          </label>
          <input id="track-phone" name="phone" type="tel" className={styles.input} required maxLength={32} defaultValue={values?.phone ?? ''} dir="ltr" />
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.primary}>
          {t('trackSubmit')}
        </button>
      </div>
    </form>
  );
}
