import Link from 'next/link';
import type { Locale } from '@/sdk';
import type { CategoryFilterLink, CategoryFilters as CategoryFiltersData } from '@/lib/category-filters';
import { translator } from '@/lib/i18n';
import { resolveTarget } from '@/lib/routing';
import styles from './Listing.module.css';

interface CategoryFiltersProps {
  filters: CategoryFiltersData;
  locale: Locale;
  /** Leave out "Sub category" (the backend already sends a `categories` facet for this listing). */
  withoutSubCategories?: boolean;
}

/**
 * The old storefront's "Categories" (radio list of the top categories) and "Sub category" (the
 * page's category's groups and sub-categories, check boxes) filter sections, drawn from the
 * category tree. Plain links to each node's Target, so they work without JavaScript and search
 * engines follow them.
 */
export function CategoryFilters({ filters, locale, withoutSubCategories = false }: CategoryFiltersProps) {
  const t = translator(locale);
  const sub = withoutSubCategories ? null : filters.subCategories;
  return (
    <>
      {filters.categories.length > 0 && (
        <details className={styles.facet} open data-testid="category-filter" data-section="categories">
          <summary className={styles.facetTitle}>{t('catalogFilterCategories')}</summary>
          <ul className={styles.values}>
            {filters.categories.map((item) => (
              <li key={item.id}>
                <TreeLink item={item} locale={locale} mark="radio" />
              </li>
            ))}
          </ul>
        </details>
      )}
      {sub && (
        <details className={styles.facet} open={sub.open} data-testid="category-filter" data-section="sub-categories">
          <summary className={styles.facetTitle}>{t('catalogFilterSubCategory')}</summary>
          <div className={styles.treeGroups}>
            {sub.groups.map((group, index) => (
              <div key={group.group?.id ?? `loose-${index}`} className={styles.treeGroup}>
                {group.group && <TreeLink item={group.group} locale={locale} mark={null} className={styles.treeGroupTitle} />}
                <ul className={`${styles.values} ${group.group ? styles.treeSubs : ''}`}>
                  {group.items.map((item) => (
                    <li key={item.id}>
                      <TreeLink item={item} locale={locale} mark="check" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function TreeLink({ item, locale, mark, className = '' }: { item: CategoryFilterLink; locale: Locale; mark: 'radio' | 'check' | null; className?: string }) {
  const t = translator(locale);
  const link = resolveTarget(item.target, locale);
  const body = (
    <>
      {mark && <span className={mark === 'radio' ? styles.radio : styles.check} aria-hidden="true" />}
      <span className={styles.valueLabel}>{item.name}</span>
      {item.selected && <span className="visually-hidden">{t('catalogSelected')}</span>}
    </>
  );
  const classes = `${styles.value} ${item.selected ? styles.valueSelected : ''} ${className}`;
  if (!link || link.external) {
    return (
      <span className={classes} data-selected={item.selected} data-testid="category-filter-value">
        {body}
      </span>
    );
  }
  return (
    <Link href={link.href} className={classes} aria-current={item.current ? 'page' : undefined} data-selected={item.selected} data-testid="category-filter-value">
      {body}
    </Link>
  );
}
