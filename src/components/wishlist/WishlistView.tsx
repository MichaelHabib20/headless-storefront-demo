import Link from 'next/link';
import type { Locale, WishlistPage } from '@/sdk';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { routes } from '@/lib/routing';
import { ProductCard } from '../product/ProductCard';
import { Pagination } from '../ui/Pagination';
import { WishlistGrid, type WishlistAction } from './WishlistGrid';
import styles from './Wishlist.module.css';

/** What the page could load: the list, no shopper session yet (nothing saved), or a failure. */
export type WishlistState = { status: 'ok'; wishlist: WishlistPage } | { status: 'guest' } | { status: 'error' };

interface WishlistViewProps {
  state: WishlistState;
  locale: Locale;
  /** Other query parameters to keep on page links. */
  pageQuery?: Record<string, string | number | undefined>;
  onRemove: WishlistAction;
  onMoveToCart: WishlistAction;
}

export function WishlistView({ state, locale, pageQuery, onRemove, onMoveToCart }: WishlistViewProps) {
  const t = translator(locale);
  const wishlist = state.status === 'ok' ? state.wishlist : null;
  const total = wishlist?.pagination.total ?? 0;
  const count = formatNumber(total, locale);

  return (
    <div className={`container ${styles.page}`} data-testid="wishlist">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('wishlistTitle')}</h1>
        {total > 0 && <p className={styles.count}>{t('wishlistCount').replace('{count}', count)}</p>}
      </header>

      {state.status === 'error' ? (
        <div className={styles.empty} role="alert">
          <p className={styles.emptyText}>{t('wishlistLoadError')}</p>
          <Link href={routes.wishlist(locale)} className={styles.cta}>
            {t('tryAgain')}
          </Link>
        </div>
      ) : wishlist && wishlist.items.length > 0 ? (
        <>
          <WishlistGrid
            entries={wishlist.items.map((product) => ({
              productId: product.id,
              name: product.name,
              canAddToCart: product.purchase.canAddToCart,
              // The wishlist has its own Remove / Move to cart buttons: no duplicate card actions.
      card: <ProductCard product={product} locale={locale} showActions={false} />,
            }))}
            locale={locale}
            cartHref={routes.cart(locale)}
            labels={{
              remove: t('wishlistRemove'),
              moveToCart: t('wishlistMoveToCart'),
              removed: t('wishlistRemoved'),
              moved: t('wishlistMoved'),
              viewCart: t('wishlistViewCart'),
              error: t('wishlistActionError'),
            }}
            onRemove={onRemove}
            onMoveToCart={onMoveToCart}
          />
          <Pagination
            pagination={wishlist.pagination}
            baseHref={routes.wishlist(locale)}
            query={pageQuery}
            locale={locale}
            labels={{ nav: t('wishlistPages'), previous: t('previous'), next: t('next'), page: t('wishlistPage') }}
          />
        </>
      ) : (
        <div className={styles.empty} data-testid="wishlist-empty">
          <h2 className={styles.emptyTitle}>{t('wishlistEmptyTitle')}</h2>
          <p className={styles.emptyText}>{t('wishlistEmptyText')}</p>
          <Link href={routes.home(locale)} className={styles.cta}>
            {t('wishlistStartShopping')}
          </Link>
        </div>
      )}
    </div>
  );
}
