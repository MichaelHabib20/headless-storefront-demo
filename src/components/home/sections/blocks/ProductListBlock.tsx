import { translator } from '@/lib/i18n';
import { ProductCard } from '../../../product/ProductCard';
import { Rail, RailItem } from '../../../ui/Rail';
import type { BlockProps } from './types';
import styles from './Blocks.module.css';

/**
 * The section's own products (the backend's list, in its order), at most the merchant's `limit`,
 * as a scrolling row or a grid. Prices are drawn by ProductCard (the locked money components).
 */
export function ProductListBlock({ block, context }: BlockProps<'product_list'>) {
  const products = context.products.slice(0, Math.max(1, block.limit || context.products.length));
  if (products.length === 0) return null;
  const t = translator(context.locale);
  if (block.display === 'grid') {
    return (
      <ul className={styles.productGrid} aria-label={context.label} data-block="product_list" data-variant="grid">
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} locale={context.locale} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div data-block="product_list" data-variant="rail">
      <Rail label={context.label} previousLabel={t('previous')} nextLabel={t('next')} perView={5}>
        {products.map((product) => (
          <RailItem key={product.id}>
            <ProductCard product={product} locale={context.locale} />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}
