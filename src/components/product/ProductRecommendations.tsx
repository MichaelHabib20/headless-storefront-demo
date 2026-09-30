import type { Locale, RecommendationSection } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Money } from '@/money';
import { Rail, RailItem } from '../ui/Rail';
import { SectionHeading } from '../ui/SectionHeading';
import { ProductCard } from './ProductCard';
import styles from './ProductRecommendations.module.css';

interface ProductRecommendationsProps {
  /** `sections` from the API, in the order to show them (only sections with products). */
  sections: RecommendationSection[];
  locale: Locale;
}

/**
 * Product rows under the product (related, similar, bought together), titled by the backend.
 * The bought-together row shows the backend's `total` for all of its products; nothing is added up here.
 */
export function ProductRecommendations({ sections, locale }: ProductRecommendationsProps) {
  if (!sections.length) return null;
  const t = translator(locale);

  return (
    <>
      {sections.map((section, index) => {
        const headingId = `recommendations-${index}`;
        return (
          <section key={`${section.key}-${index}`} className={styles.section} aria-labelledby={headingId} data-testid="product-recommendations" data-key={section.key}>
            <SectionHeading id={headingId} title={section.title} locale={locale} viewAllLabel={t('viewAll')} />
            {section.total && (
              <p className={styles.total}>
                <span>{t('productTogetherTotal')}</span>
                <Money value={section.total} as="strong" className={styles.totalValue} data-testid="together-total" />
              </p>
            )}
            <Rail label={section.title} previousLabel={t('previous')} nextLabel={t('next')} perView={5}>
              {section.products.map((product) => (
                <RailItem key={product.id}>
                  <ProductCard product={product} locale={locale} />
                </RailItem>
              ))}
            </Rail>
          </section>
        );
      })}
    </>
  );
}
