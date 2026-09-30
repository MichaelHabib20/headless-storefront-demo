import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { formatQuantity } from './quantity';
import styles from './CartView.module.css';

interface CartTitleProps {
  locale: Locale;
  /** `cart.summary.itemCount` from the API (total units). Left out when there is no cart to show. */
  itemCount?: number;
}

/** The cart page heading, e.g. "Shopping cart (3)". The number is the API's, never counted here. */
export function CartTitle({ locale, itemCount }: CartTitleProps) {
  const t = translator(locale);
  const title = itemCount === undefined ? t('cartTitle') : t('cartTitleWithCount').replace('{count}', formatQuantity(itemCount, locale));
  return (
    <h1 className={styles.title} data-testid="cart-title">
      {title}
    </h1>
  );
}
