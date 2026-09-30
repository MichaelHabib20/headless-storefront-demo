import type { CheckoutTotalLine, Locale, Money as MoneyValue } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import styles from './Checkout.module.css';

interface TotalLinesProps {
  /** The backend's price breakdown, in its order (`totals.lines` of a checkout or an order). */
  lines: CheckoutTotalLine[];
  /** What the shopper pays (`totals.total`). */
  total: MoneyValue;
  locale: Locale;
}

/**
 * A price breakdown exactly as the backend wrote it: each row is its label with its amount
 * text, or the text it sends instead of an amount ("Free"). Nothing is added up here, and a
 * row the backend did not send is not invented. `kind` only picks a style.
 */
export function TotalLines({ lines, total, locale }: TotalLinesProps) {
  const t = translator(locale);
  return (
    <dl className={styles.totals} data-testid="checkout-totals">
      {lines.map((line, index) => (
        <div key={`${line.kind}-${index}`} className={styles.totalLine} data-kind={line.kind} data-testid="checkout-total-line">
          <dt>{line.label}</dt>
          {line.text !== null || !line.amount ? <dd>{line.text}</dd> : <Money value={line.amount} as="dd" />}
        </div>
      ))}
      <div className={`${styles.totalLine} ${styles.grandTotal}`}>
        <dt>{t('checkoutTotal')}</dt>
        <Money value={total} as="dd" data-testid="checkout-total" />
      </div>
    </dl>
  );
}
