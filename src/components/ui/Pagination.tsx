import Link from 'next/link';
import type { Locale, Pagination as PaginationData } from '@/sdk';
import { Icon } from './Icon';
import styles from './Pagination.module.css';

export type PageItem = number | 'gap';

type Query = Record<string, string | number | undefined>;

/**
 * Page numbers to show: the first and last page, and `siblings` pages around the current
 * one. Skipped runs become a 'gap' ("…"); a gap never hides a single page.
 */
export function pageList(current: number, total: number, siblings = 1): PageItem[] {
  if (total < 1) return [];
  if (total === 1) return [1];
  const page = Math.min(Math.max(current, 1), total);
  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);

  const items: PageItem[] = [1];
  if (start > 2) items.push(start === 3 ? 2 : 'gap');
  for (let n = start; n <= end; n++) items.push(n);
  if (end < total - 1) items.push(end === total - 2 ? total - 1 : 'gap');
  items.push(total);
  return items;
}

/** Link to a page of a list: page 1 is the bare URL; other query parameters are kept. */
export function pageHref(baseHref: string, page: number, query: Query = {}): string {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && key !== 'page') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${baseHref}?${search}` : baseHref;
}

/** A positive whole number from a search parameter (`?page=3`); anything else is `fallback`. */
export function positiveIntParam(value: string | string[] | undefined, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const number = Number(raw);
  return number >= 1 ? Math.min(number, max) : fallback;
}

export interface PaginationLabels {
  /** Accessible name of the navigation, e.g. "Wishlist pages" */
  nav: string;
  previous: string;
  next: string;
  /** Accessible name of a page link, before its number, e.g. "Page" → "Page 2" */
  page: string;
}

interface PaginationProps {
  pagination: Pick<PaginationData, 'page' | 'totalPages'>;
  baseHref: string;
  /** Other query parameters to keep on every page link. */
  query?: Query;
  locale: Locale;
  labels: PaginationLabels;
}

/** Previous / page numbers / next, as plain links (works without JavaScript). Hidden for a single page. */
export function Pagination({ pagination, baseHref, query, locale, labels }: PaginationProps) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  const number = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG');
  const href = (n: number) => pageHref(baseHref, n, query);
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label={labels.nav} className={styles.pagination} data-testid="pagination">
      {hasPrevious ? (
        <Link href={href(page - 1)} rel="prev" className={styles.step}>
          <Icon name="chevron" size={18} className={styles.back} />
          <span>{labels.previous}</span>
        </Link>
      ) : (
        <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
          <Icon name="chevron" size={18} className={styles.back} />
          <span>{labels.previous}</span>
        </span>
      )}

      <ol className={styles.pages}>
        {pageList(page, totalPages).map((item, index) => (
          <li key={item === 'gap' ? `gap-${index}` : item}>
            {item === 'gap' ? (
              <span className={styles.gap} aria-hidden="true">
                …
              </span>
            ) : (
              <Link
                href={href(item)}
                className={styles.page}
                aria-label={`${labels.page} ${number.format(item)}`}
                aria-current={item === page ? 'page' : undefined}
              >
                {number.format(item)}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {hasNext ? (
        <Link href={href(page + 1)} rel="next" className={styles.step}>
          <span>{labels.next}</span>
          <Icon name="chevron" size={18} directional />
        </Link>
      ) : (
        <span className={`${styles.step} ${styles.disabled}`} aria-hidden="true">
          <span>{labels.next}</span>
          <Icon name="chevron" size={18} directional />
        </span>
      )}
    </nav>
  );
}
