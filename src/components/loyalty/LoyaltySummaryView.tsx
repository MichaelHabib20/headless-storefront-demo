import type { Locale, LoyaltySummary } from '@/sdk';
import { RichText } from '@/components/ui/RichText';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import styles from './Loyalty.module.css';

/** The points, their value and Gold level as the backend wrote them (El Dokan or iVend alike). */
export function LoyaltySummaryView({ locale, summary }: { locale: Locale; summary: LoyaltySummary }) {
  const t = translator(locale);
  return (
    <section className={styles.card} data-testid="loyalty-summary" data-provider={summary.provider}>
      <p className={styles.label}>{t('loyaltyBalance')}</p>
      <p className={styles.balance} data-testid="loyalty-points">
        {summary.points.text}
      </p>
      {summary.tier && (
        <p className={styles.tier} data-gold={summary.tier.gold} data-testid="loyalty-tier">
          <strong>{summary.tier.label}</strong>
          {summary.tier.message && <span>{summary.tier.message}</span>}
        </p>
      )}
      {(summary.value || summary.storeCredit) && (
        <dl className={styles.facts}>
          {summary.value && (
            <div>
              <dt>{t('loyaltyValue')}</dt>
              <Money value={summary.value} as="dd" data-testid="loyalty-value" />
            </div>
          )}
          {summary.storeCredit && (
            <div>
              <dt>{t('loyaltyStoreCredit')}</dt>
              <Money value={summary.storeCredit} as="dd" data-testid="loyalty-credit" />
            </div>
          )}
        </dl>
      )}
      {summary.pending && (
        <p className={styles.muted} data-testid="loyalty-pending">
          {summary.pending}
        </p>
      )}
      {summary.expiring && (
        <p className={styles.notice} data-testid="loyalty-expiring">
          {summary.expiring}
        </p>
      )}
      <RichText value={summary.description} className={styles.description} data-testid="loyalty-description" />
    </section>
  );
}
