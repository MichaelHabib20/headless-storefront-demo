import type { CheckoutBlocker, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './CartSummary.module.css';

/** Why checkout is not allowed, in the backend's words. Renders nothing when there is no blocker. */
export function CheckoutBlockers({ blockers, locale, id }: { blockers: CheckoutBlocker[]; locale: Locale; id?: string }) {
  if (!blockers.length) return null;
  const t = translator(locale);
  return (
    <div id={id} className={styles.blockers} data-testid="checkout-blockers">
      <p className={styles.blockersTitle}>{t('cartCheckoutBlocked')}</p>
      <ul className={styles.blockerList}>
        {blockers.map((blocker, index) => (
          <li key={`${blocker.code}-${index}`} data-code={blocker.code}>
            {blocker.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
