import type { Locale, StoreStatus } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './ShellBanners.module.css';

/** Shown on every page while the store does not take orders (`Layout.storeStatus.acceptingOrders` false). */
export function StoreClosedNotice({ status, locale }: { status: StoreStatus | null | undefined; locale: Locale }) {
  if (!status || status.acceptingOrders) return null;
  const t = translator(locale);
  return (
    <div className={styles.closed} role="status" data-testid="store-closed">
      <p>
        <strong>{t('storeClosedTitle')}</strong>
        {status.message && <span> — {status.message}</span>}
      </p>
    </div>
  );
}
