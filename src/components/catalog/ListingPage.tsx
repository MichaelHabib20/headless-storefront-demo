import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ListingScope, Locale } from '@/sdk';
import { loadListing } from '@/lib/catalog.server';
import { translator } from '@/lib/i18n';
import { JsonLd } from '@/lib/jsonld';
import { listingHref, toSearchParams, type PageParams } from '@/lib/listing';
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
export async function ListingPage({ locale, scope, params, links }: ListingPageProps) {
  const result = await loadListing(locale, scope, params);
  const current = toSearchParams(params).toString();
  if (result.status === 'not_found') notFound();
  if (result.status === 'ok') {
    return (
      <>
        <JsonLd seo={result.listing.seo} locale={locale} />
        <ListingView listing={result.listing} locale={locale} links={links} current={current} />
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
