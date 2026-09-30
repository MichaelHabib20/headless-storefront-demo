import type { CSSProperties } from 'react';
import type { Cart, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import styles from './CartSummary.module.css';

type MinimumOrder = NonNullable<Cart['checkout']['minimumOrder']>;

interface MinimumOrderProgressProps {
  minimumOrder: MinimumOrder;
  /** From the backend: true when there is no `minimum_order` checkout blocker. */
  reached: boolean;
  locale: Locale;
}

/**
 * The store's minimum order and how much is left, both as the backend sent them. The bar is
 * filled to the backend's `progressPercent` (see `.fill`); nothing is computed here.
 */
export function MinimumOrderProgress({ minimumOrder, reached, locale }: MinimumOrderProgressProps) {
  const t = translator(locale);
  const bar = { '--cart-progress': `${minimumOrder.progressPercent}%` } as CSSProperties;

  return (
    <div className={styles.minimum} data-testid="cart-minimum-order">
      <div className={styles.minimumRow}>
        <span>{t('cartMinimumOrder')}</span>
        <Money value={minimumOrder.amount} />
      </div>
      <div className={styles.bar} style={bar} aria-hidden="true" data-testid="cart-minimum-bar">
        <span className={styles.fill} />
      </div>
      {reached ? (
        <p className={styles.minimumDone}>{t('cartMinimumReached')}</p>
      ) : (
        <div className={styles.minimumRow}>
          <span>{t('cartMinimumRemaining')}</span>
          <Money value={minimumOrder.remaining} as="strong" data-testid="cart-minimum-remaining" />
        </div>
      )}
    </div>
  );
}
