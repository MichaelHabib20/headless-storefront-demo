import Link from 'next/link';
import type { Cart, Locale } from '@/sdk';
import { formatQuantity } from '@/components/cart/quantity';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Money } from '@/money';
import { TargetLink } from '../ui/TargetLink';
import styles from './Checkout.module.css';

interface CheckoutItemsProps {
  /** `checkout.cart`: the same cart the cart page shows. */
  cart: Cart;
  /** The backend is computing: line totals on screen would belong to the old choices. */
  pending: boolean;
  locale: Locale;
}

/**
 * The cart lines, read-only (quantities are changed on the cart page). Line totals and
 * availability messages are the backend's.
 */
export function CheckoutItems({ cart, pending, locale }: CheckoutItemsProps) {
  const t = translator(locale);
  return (
    <section className={styles.section} aria-labelledby="checkout-items-title" data-testid="checkout-items">
      <div className={styles.sectionHead}>
        <h2 id="checkout-items-title" className={styles.sectionTitle}>
          {t('checkoutItemsTitle')}
        </h2>
        <Link href={routes.cart(locale)} className={styles.textLink}>
          {t('checkoutEditCart')}
        </Link>
      </div>

      <ul className={styles.items}>
        {cart.items.map((item) => (
          <li key={item.product.id} className={styles.item} data-testid="checkout-item">
            <div className={styles.itemMedia}>
              {item.product.image && (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={item.product.image.url} alt="" loading="lazy" decoding="async" className={styles.itemImage} />
              )}
            </div>
            <div className={styles.itemInfo}>
              <h3 className={styles.itemName}>
                <TargetLink target={item.product.target} locale={locale}>
                  {item.product.name}
                </TargetLink>
              </h3>
              <p className={styles.itemQuantity}>
                {t('cartQuantity')}: {formatQuantity(item.quantity, locale)}
              </p>
              {item.availability.message && <p className={styles.itemProblem}>{item.availability.message}</p>}
            </div>
            {!pending && <Money value={item.lineTotal} as="p" className={styles.itemTotal} data-testid="checkout-item-total" />}
          </li>
        ))}
      </ul>
    </section>
  );
}
