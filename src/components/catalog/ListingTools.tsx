import Form from 'next/form';
import Link from 'next/link';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { PRICE_FIELDS, SEARCH_FIELD, currentField, hrefWithout, keptFields } from '@/lib/listing';
import { routes } from '@/lib/routing';
import type { ListingLinks } from './ListingFilters';
import styles from './Listing.module.css';

interface ListingToolsProps {
  locale: Locale;
  links: ListingLinks;
  /** The page's current query string. */
  current: string;
  /** The backend sent its own price range facet: it is drawn with the facets, not here. */
  withoutPrice?: boolean;
}

/**
 * The old storefront's first two filter sections, shown on every listing even when the store's
 * side filters are off (`facets: []`): **Search** and **Price** (from / to, Apply, Clear).
 * Plain GET forms with the old parameter names (`search`, `price_from`, `price_to`), so they work
 * without JavaScript; the page's other parameters ride along as hidden fields.
 */
export function ListingTools({ locale, links, current, withoutPrice = false }: ListingToolsProps) {
  return (
    <>
      <ListingSearch locale={locale} links={links} current={current} />
      {!withoutPrice && <PriceFilter locale={locale} links={links} current={current} />}
    </>
  );
}

/**
 * Search inside the listing. On the search page it changes the search text and keeps the other
 * parameters. The API takes one scope per listing (a search text cannot narrow a category, brand
 * or list: 422 `one_scope`), so elsewhere it opens the search page with the text.
 */
function ListingSearch({ locale, links, current }: Omit<ListingToolsProps, 'withoutPrice'>) {
  const t = translator(locale);
  const searchPage = routes.search(locale);
  const here = links.path === searchPage;
  const id = `listing-search-${locale}`;
  return (
    <section className={styles.facet} data-testid="listing-search" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.toolTitle}>
        {t('catalogSearch')}
      </h3>
      <Form action={here ? links.path : searchPage} className={styles.toolForm} role="search" aria-labelledby={`${id}-title`}>
        {here && keptFields(current, 'search').map(([name, value], index) => <input key={`${name}-${index}`} type="hidden" name={name} value={value} />)}
        <label htmlFor={id} className="visually-hidden">
          {t('catalogSearchLabel')}
        </label>
        <div className={styles.searchRow}>
          <input
            id={id}
            name={SEARCH_FIELD}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            defaultValue={here ? currentField(current, SEARCH_FIELD, 'q') : ''}
            className={styles.rangeInput}
            key={here ? currentField(current, SEARCH_FIELD, 'q') : 'search'}
          />
          <button type="submit" className={styles.rangeApply}>
            {t('catalogSearchGo')}
          </button>
        </div>
      </Form>
    </section>
  );
}

/** From / to with Apply and Clear, sent as `price_from` / `price_to` (the backend reads them). */
function PriceFilter({ locale, links, current }: Omit<ListingToolsProps, 'withoutPrice'>) {
  const t = translator(locale);
  const id = `listing-price-${locale}`;
  const min = currentField(current, PRICE_FIELDS.min, 'priceMin');
  const max = currentField(current, PRICE_FIELDS.max, 'priceMax');
  return (
    <section className={styles.facet} data-testid="price-filter" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={styles.toolTitle}>
        {t('catalogPrice')}
      </h3>
      <Form action={links.path} scroll={false} className={styles.range} key={`${min}|${max}`} data-testid="price-form">
        {keptFields(current, 'price').map(([name, value], index) => (
          <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
        ))}
        <div className={styles.rangeInputs}>
          <label htmlFor={`${id}-min`} className={styles.rangeLabel}>
            {t('catalogPriceFrom')}
          </label>
          <input id={`${id}-min`} name={PRICE_FIELDS.min} type="number" min={0} step="any" inputMode="decimal" defaultValue={min} className={styles.rangeInput} />
          <label htmlFor={`${id}-max`} className={styles.rangeLabel}>
            {t('catalogPriceTo')}
          </label>
          <input id={`${id}-max`} name={PRICE_FIELDS.max} type="number" min={0} step="any" inputMode="decimal" defaultValue={max} className={styles.rangeInput} />
        </div>
        <div className={styles.toolActions}>
          <button type="submit" className={styles.rangeApply}>
            {t('catalogApply')}
          </button>
          <Link href={hrefWithout(links.path, current, 'price')} scroll={false} rel="nofollow" className={styles.toolClear} data-testid="price-clear">
            {t('catalogClear')}
          </Link>
        </div>
      </Form>
    </section>
  );
}
