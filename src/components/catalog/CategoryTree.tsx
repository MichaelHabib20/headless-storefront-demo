import type { CategoryNode, Locale } from '@/sdk';
import { TargetLink } from '../ui/TargetLink';
import styles from './Catalog.module.css';

interface CategoryTreeProps {
  items: CategoryNode[];
  locale: Locale;
}

/**
 * The category tree as the backend sent it: a card per category with its image, then its
 * groups and their sub-categories. Every name links through its Target.
 */
export function CategoryTree({ items, locale }: CategoryTreeProps) {
  return (
    <ul className={styles.tree} data-testid="category-tree">
      {items.map((category) => (
        <li key={category.id} className={styles.category} data-testid="category">
          <TargetLink target={category.target} locale={locale} className={styles.categoryLink}>
            <span className={styles.categoryMedia}>
              {category.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={category.image.url} alt={category.image.alt ?? ''} loading="lazy" decoding="async" className={styles.categoryImage} />
              ) : (
                <span className={styles.placeholder} aria-hidden="true" />
              )}
            </span>
            <span className={styles.categoryName}>{category.name}</span>
          </TargetLink>
          {category.children.length > 0 && (
            <ul className={styles.groups}>
              {category.children.map((group) => (
                <li key={group.id}>
                  <TargetLink target={group.target} locale={locale} className={styles.groupLink}>
                    {group.name}
                  </TargetLink>
                  {group.children.length > 0 && (
                    <ul className={styles.subs}>
                      {group.children.map((sub) => (
                        <li key={sub.id}>
                          <TargetLink target={sub.target} locale={locale} className={styles.subLink}>
                            {sub.name}
                          </TargetLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
