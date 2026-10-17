import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ListingScope, Locale } from '@/sdk';
import { loadCategoryTree, loadListing } from '@/lib/catalog.server';
import { categoryFilters, findCategoryChain, type CategoryFilters } from '@/lib/category-filters';
import { translator } from '@/lib/i18n';
import { JsonLd } from '@/lib/jsonld';
import { alternateHrefs } from '@/lib/seo';
import { PageAlternates } from '@/components/layout/PageAlternates';
import { linksWithSearch, listingHref, toSearchParams, type PageParams } from '@/lib/listing';
import { ListingView } from './ListingView';
import type { ListingLinks } from './ListingFilters';
import styles from './Listing.module.css';

interface ListingPageProps {
  locale: Locale;
  scope: ListingScope;
  /** All of the page's own query parameters; they go to the API untouched. */
  params: PageParams;
  links: ListingLinks;
}

/**
 * Loads one listing and draws it, for every listing route. Unknown scope → 404; parameters
 * the backend refuses → its message and a way back; the API down → a retry.
 */
export async function ListingPage({ locale, scope, params, links: routeLinks }: ListingPageProps) {
  const result = await loadListing(locale, scope, params);
  const own = toSearchParams(params);
  const current = own.toString();
  // a search inside the listing stays on its sort, filter and "clear" links
  const links = linksWithSearch(routeLinks, own);
  if (result.status === 'not_found') notFound();
  if (result.status === 'ok') {
    const categories = await loadCategoryFilters(locale, scope);
    return (
      <>
        <JsonLd seo={result.listing.seo} locale={locale} />
        <PageAlternates hrefs={alternateHrefs(result.listing.seo)} />
        <ListingView listing={result.listing} locale={locale} links={links} current={current} categories={categories} />
      </>
    );
  }

  const t = translator(locale);
  const invalid = result.status === 'invalid';
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.empty} role="alert" data-testid={invalid ? 'listing-invalid' : 'listing-error'}>
        <h1 className={styles.emptyTitle}>{invalid ? t('catalogInvalidTitle') : t('errorTitle')}</h1>
        <p className={styles.emptyText}>{invalid ? result.message : t('catalogLoadError')}</p>
        <Link href={invalid ? listingHref(links.path, '', links.keep) : listingHref(links.path, current)} className={styles.cta}>
          {invalid ? t('catalogShowAll') : t('tryAgain')}
        </Link>
      </div>
    </div>
  );
}

/**
 * The "Categories" / "Sub category" sections, from the category tree like the old storefront
 * (not from the backend's facets, which a store may switch off). Hidden on custom lists, as there;
 * a category page has its category, group and sub-category selected. The tree failing to load
 * only drops the sections.
 */
async function loadCategoryFilters(locale: Locale, scope: ListingScope): Promise<CategoryFilters | null> {
  if ('list' in scope) return null;
  const tree = await loadCategoryTree(locale);
  if (!tree) return null;
  const path = 'category' in scope && !('deals' in scope) ? scope.category : null;
  if (!path?.length) return categoryFilters(tree, null);
  const chain = findCategoryChain(tree, path) ?? findCategoryChain(tree, path, await loadCategoryTree(locale === 'en' ? 'ar' : 'en'));
  return categoryFilters(tree, chain);
}
