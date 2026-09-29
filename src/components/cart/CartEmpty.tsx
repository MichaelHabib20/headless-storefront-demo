import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import styles from './CartView.module.css';

/** No items (or no cart yet: visitors without a session never get one just by looking). */
export function CartEmpty({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <div className={styles.empty} data-testid="cart-empty">
      <Icon name="bag" size={48} />
      <h2 className={styles.emptyTitle}>{t('cartEmptyTitle')}</h2>
      <p className={styles.emptyText}>{t('cartEmptyText')}</p>
      <Link href={routes.home(locale)} className={styles.cta}>
        {t('cartContinueShopping')}
        <Icon name="arrow" size={20} directional />
      </Link>
    </div>
  );
}
