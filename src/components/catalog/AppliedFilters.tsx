import Link from 'next/link';
import type { AppliedFilter } from '@/sdk';
import { listingHref } from '@/lib/listing';
import { Icon } from '../ui/Icon';
import type { ListingLinks } from './ListingFilters';
import styles from './Listing.module.css';

interface AppliedFiltersProps {
  filters: AppliedFilter[];
  /** `clearFiltersQuery` from the API; null = no filter in use. */
  clearQuery: string | null;
  links: ListingLinks;
  labels: { list: string; remove: string; clearAll: string };
}

/** Chips for the filters in use (each removes itself with its `removeQuery`) and "clear all". */
export function AppliedFilters({ filters, clearQuery, links, labels }: AppliedFiltersProps) {
  if (!filters.length && clearQuery === null) return null;
  return (
    <div className={styles.applied} data-testid="applied-filters">
      <ul className={styles.chips} aria-label={labels.list}>
        {filters.map((filter, index) => (
          <li key={`${filter.label}-${index}`}>
            <Link href={listingHref(links.path, filter.removeQuery, links.keep)} scroll={false} rel="nofollow" className={styles.chip} aria-label={`${labels.remove}: ${filter.label}`} data-testid="applied-filter">
              <span>{filter.label}</span>
              <Icon name="close" size={14} />
            </Link>
          </li>
        ))}
      </ul>
      {clearQuery !== null && (
        <Link href={listingHref(links.path, clearQuery, links.keep)} scroll={false} rel="nofollow" className={styles.clearAll}>
          {labels.clearAll}
        </Link>
      )}
    </div>
  );
}
