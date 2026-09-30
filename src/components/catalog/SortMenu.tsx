import Link from 'next/link';
import type { ListingSortOption } from '@/sdk';
import { listingHref } from '@/lib/listing';
import { Icon } from '../ui/Icon';
import type { ListingLinks } from './ListingFilters';
import styles from './Listing.module.css';

interface SortMenuProps {
  options: ListingSortOption[];
  links: ListingLinks;
  label: string;
}

/**
 * The sort choices the backend sent, in its order, as links (works without JavaScript).
 * Re-mounted (closed) whenever the selected choice changes.
 */
export function SortMenu({ options, links, label }: SortMenuProps) {
  if (!options.length) return null;
  const selected = options.find((option) => option.selected);
  return (
    <details className={styles.sort} key={selected?.query ?? ''} data-testid="sort">
      <summary className={styles.sortSummary}>
        <span className={styles.sortLabel}>{label}</span>
        {selected && <strong className={styles.sortSelected}>{selected.label}</strong>}
        <Icon name="chevron" size={16} className={styles.sortChevron} />
      </summary>
      <ul className={styles.sortList} aria-label={label}>
        {options.map((option, index) => (
          <li key={`${option.label}-${index}`}>
            <Link
              href={listingHref(links.path, option.query, links.keep)}
              scroll={false}
              rel="nofollow"
              className={`${styles.sortOption} ${option.selected ? styles.sortOptionSelected : ''}`}
              aria-current={option.selected ? 'true' : undefined}
            >
              {option.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
