import Link from 'next/link';
import type { CompareData, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { ProductCard } from '../product/ProductCard';
import { CompareTable, type CompareAction } from './CompareTable';
import styles from './Compare.module.css';

/** What the page could load: the comparison, no shopper session yet (nothing added), or a failure. */
export type CompareState = { status: 'ok'; compare: CompareData } | { status: 'guest' } | { status: 'error' };

interface CompareViewProps {
  state: CompareState;
  locale: Locale;
  onRemove: CompareAction;
}

export function CompareView({ state, locale, onRemove }: CompareViewProps) {
  const t = translator(locale);
  const compare = state.status === 'ok' ? state.compare : null;

  return (
    <div className={`container ${styles.page}`} data-testid="compare">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('compareTitle')}</h1>
      </header>

      {state.status === 'error' ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyText}>{t('compareLoadError')}</p>
          <Link href={routes.compare(locale)} className={styles.cta}>
            {t('tryAgain')}
          </Link>
        </div>
      ) : compare && compare.products.length > 0 ? (
        <CompareTable
          columns={compare.products.map((product) => ({
            productId: product.id,
            name: product.name,
            card: <ProductCard product={product} locale={locale} />,
          }))}
          rows={compare.attributes}
          maxItems={compare.maxItems}
          locale={locale}
          labels={{
            table: t('compareTableLabel'),
            product: t('compareProduct'),
            remove: t('compareRemove'),
            removed: t('compareRemoved'),
            noValue: t('compareNoValue'),
            note: t('compareNote'),
            noteUnlimited: t('compareNoteUnlimited'),
            error: t('compareActionError'),
          }}
          onRemove={onRemove}
        />
      ) : (
        <div className={styles.empty} data-testid="compare-empty">
          <h2 className={styles.emptyTitle}>{t('compareEmptyTitle')}</h2>
          <p className={styles.emptyText}>{t('compareEmptyText')}</p>
          <Link href={routes.home(locale)} className={styles.cta}>
            {t('compareStartShopping')}
          </Link>
        </div>
      )}
    </div>
  );
}
