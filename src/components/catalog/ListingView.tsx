import Link from 'next/link';
import type { Locale, ProductListing } from '@/sdk';
import { hasCategoryFacet, type CategoryFilters as CategoryFiltersData } from '@/lib/category-filters';
import { translator } from '@/lib/i18n';
import { listingHref, listingPageHref } from '@/lib/listing';
import { formatNumber } from '@/lib/numbers';
import { routes } from '@/lib/routing';
import { ProductCard } from '../product/ProductCard';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { Pagination } from '../ui/Pagination';
import { ProductImage } from '../ui/ProductImage';
import { RichText } from '../ui/RichText';
import { AppliedFilters } from './AppliedFilters';
import { CategoryFilters } from './CategoryFilters';
import { FilterDrawer, FilterPanel, FilterToggle } from './FilterDrawer';
import { ListingFilters, type ListingLinks } from './ListingFilters';
import { ListingTools } from './ListingTools';
import { SortMenu } from './SortMenu';
import styles from './Listing.module.css';

interface ListingViewProps {
  listing: ProductListing;
  locale: Locale;
  links: ListingLinks;
  /** The page's current query string, kept as it is on the page links. */
  current?: string;
  /** The "Categories" / "Sub category" sections from the category tree; null on pages without them (lists). */
  categories?: CategoryFiltersData | null;
}

/**
 * Every listing page (category, brand, list, tag, deals, search, all products) draws this.
 * Heading, text, filters, sort, counts and pages are the backend's; every link is this page's
 * path + a `query` the backend wrote.
 */
export function ListingView({ listing, locale, links, current = '', categories = null }: ListingViewProps) {
  const t = translator(locale);
  const { context, pagination, facets } = listing;
  // Search and Price are always there (as on the old storefront), so every listing has the panel.
  const hasRange = facets.some((facet) => facet.kind === 'range');

  const filters = (
    <FilterPanel labels={{ title: t('catalogFilters'), close: t('catalogCloseFilters'), done: t('catalogShowResults') }}>
      <ListingTools locale={locale} links={links} current={current} withoutPrice={hasRange} />
      {categories && (
        // The backend's own category facet (sub-categories in the results) replaces "Sub category".
        <CategoryFilters filters={categories} locale={locale} withoutSubCategories={hasCategoryFacet(facets)} />
      )}
      <ListingFilters facets={facets} locale={locale} links={links} />
    </FilterPanel>
  );

  return (
    <div className={`container ${styles.page}`} data-testid="listing" data-listing={context.type}>
      <Breadcrumbs items={listing.breadcrumbs} locale={locale} label={t('catalogBreadcrumbs')} />

      <header className={styles.header}>
        {context.image && (
          // a missing file shows the store's placeholder, like the old storefront (never a broken icon)
          <ProductImage src={context.image.url} alt={context.image.alt ?? ''} className={styles.headerImage} loading="eager" data-testid="listing-image" />
        )}
        <div className={styles.headerText}>
          <h1 className={styles.title}>{context.title}</h1>
          <p className={styles.count} data-testid="listing-count">
            {/* what the pages can show: a listing capped at page 50 never promises more than its last page */}
            {t('catalogResults').replace('{count}', formatNumber(pagination.reachable ?? pagination.total, locale))}
          </p>
        </div>
      </header>
      <RichText value={context.description} className={styles.description} data-testid="listing-description" />

      <FilterDrawer>
        <div className={styles.layout}>
          {filters}

          <section className={styles.results} aria-label={t('catalogProducts')}>
            <div className={styles.toolbar}>
              <FilterToggle label={t('catalogFilters')} />
              <SortMenu options={listing.sort} links={links} label={t('catalogSortBy')} />
            </div>

            <AppliedFilters
              filters={listing.appliedFilters}
              clearQuery={listing.clearFiltersQuery}
              links={links}
              labels={{ list: t('catalogApplied'), remove: t('catalogRemoveFilter'), clearAll: t('catalogClearAll') }}
            />

            {listing.items.length ? (
              <ul className={styles.grid} data-testid="listing-grid">
                {listing.items.map((product) => (
                  <li key={product.id} className={styles.item}>
                    <ProductCard product={product} locale={locale} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyListing listing={listing} locale={locale} links={links} current={current} />
            )}

            <Pagination
              pagination={pagination}
              baseHref={links.path}
              hrefFor={(page) => listingPageHref(links.path, current, page)}
              locale={locale}
              labels={{ nav: t('catalogPages'), previous: t('previous'), next: t('next'), page: t('catalogPage') }}
            />
          </section>
        </div>
      </FilterDrawer>
    </div>
  );
}

/** No products: offer the way out the backend gave (clear the filters), else page 1, else all products. */
function EmptyListing({ listing, locale, links, current }: { listing: ProductListing; locale: Locale; links: ListingLinks; current: string }) {
  const t = translator(locale);
  const cta =
    listing.clearFiltersQuery !== null
      ? { href: listingHref(links.path, listing.clearFiltersQuery, links.keep), label: t('catalogClearFilters') }
      : listing.pagination.page > 1
        ? { href: listingPageHref(links.path, current, 1), label: t('catalogFirstPage') }
        : { href: routes.allProducts(locale), label: t('catalogBrowseAll') };
  return (
    <div className={styles.empty} data-testid="listing-empty">
      <h2 className={styles.emptyTitle}>{t('catalogEmptyTitle')}</h2>
      <p className={styles.emptyText}>{t('catalogEmptyText')}</p>
      <Link href={cta.href} className={styles.cta}>
        {cta.label}
      </Link>
    </div>
  );
}
