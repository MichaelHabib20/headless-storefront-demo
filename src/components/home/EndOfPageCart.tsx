import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import styles from './EndOfPageCart.module.css';

/** The closing block of the home page: a message and a button to the cart. */
export function EndOfPageCart({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <section className={`container ${styles.section}`} data-testid="end-of-page-cart">
      <div className={styles.card}>
        <span className={styles.badge}>
          <Icon name="cart" size={32} />
        </span>
        <div className={styles.copy}>
          <h2 className={styles.title}>{t('endOfPageTitle')}</h2>
          <p className={styles.text}>{t('endOfPageText')}</p>
        </div>
        <Link href={routes.cart(locale)} className={styles.button}>
          {t('endOfPageButton')}
          <Icon name="arrow" size={20} directional />
        </Link>
      </div>
    </section>
  );
}
