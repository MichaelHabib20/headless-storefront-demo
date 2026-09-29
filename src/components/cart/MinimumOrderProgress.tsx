import type { CSSProperties } from 'react';
import type { Cart, Locale } from '@/sdk';
import { formatMoney } from '@/lib/format';
import { translator } from '@/lib/i18n';
import styles from './CartSummary.module.css';

type MinimumOrder = NonNullable<Cart['checkout']['minimumOrder']>;

interface MinimumOrderProgressProps {
  minimumOrder: MinimumOrder;
  /** From the backend: true when there is no `minimum_order` checkout blocker. */
  reached: boolean;
  locale: Locale;
}

/**
 * The store's minimum order and how much is left, both as the backend sent them. The bar's
 * width is drawn by CSS from those two values (see `.fill`); no money value is computed here.
 */
export function MinimumOrderProgress({ minimumOrder, reached, locale }: MinimumOrderProgressProps) {
  const t = translator(locale);
  const { amount: minimum, remaining } = minimumOrder;
  const bar = { '--cart-minimum': minimum.amount, '--cart-remaining': remaining.amount } as CSSProperties;

  return (
    <div className={styles.minimum} data-testid="cart-minimum-order">
      <div className={styles.minimumRow}>
        <span>{t('cartMinimumOrder')}</span>
        <span>{formatMoney(minimum.amount, minimum.currency, locale)}</span>
      </div>
      <div className={`${styles.bar} ${reached ? styles.barDone : ''}`} style={bar} aria-hidden="true">
        <span className={styles.fill} />
      </div>
      {reached ? (
        <p className={styles.minimumDone}>{t('cartMinimumReached')}</p>
      ) : (
        <div className={styles.minimumRow}>
          <span>{t('cartMinimumRemaining')}</span>
          <strong data-testid="cart-minimum-remaining">{formatMoney(remaining.amount, remaining.currency, locale)}</strong>
        </div>
      )}
    </div>
  );
}
