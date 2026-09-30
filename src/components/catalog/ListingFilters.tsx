import Form from 'next/form';
import Link from 'next/link';
import type { ListingFacet, ListingFacetValue, ListingRange, Locale } from '@/sdk';
import { Money } from '@/money';
import { translator } from '@/lib/i18n';
import { formFields, listingHref, swatchColor } from '@/lib/listing';
import { formatNumber } from '@/lib/numbers';
import styles from './Listing.module.css';

export interface ListingLinks {
  /** The page's own path, without a query (e.g. routes.category(locale, path)). */
  path: string;
  /** Parameters that make the page what it is and stay on every link (search: `{ q }`). */
  keep?: Record<string, string>;
}

interface ListingFiltersProps {
  facets: ListingFacet[];
  locale: Locale;
  links: ListingLinks;
}

/**
 * The filter groups the backend sent, in its order. Every value is a link to this page with the
 * value's `query`; the price range is a small GET form. Nothing here decides which filters exist,
 * what they count or what a click does. Unknown kinds are skipped.
 */
export function ListingFilters({ facets, locale, links }: ListingFiltersProps) {
  return (
    <div className={styles.facets}>
      {facets.map((facet) => {
        const body = facetBody(facet, locale, links);
        if (!body) return null;
        return (
          <details key={facet.key} className={styles.facet} open data-testid="facet" data-facet={facet.key}>
            <summary className={styles.facetTitle}>{facet.label}</summary>
            {body}
          </details>
        );
      })}
    </div>
  );
}

/** The values of an `options` facet, the form of a `range` facet; null for kinds this storefront does not know. */
function facetBody(facet: ListingFacet, locale: Locale, links: ListingLinks) {
  if (facet.kind === 'options') return <FacetValues facet={facet} locale={locale} links={links} />;
  if (facet.kind === 'range' && facet.range) return <RangeForm facet={facet} range={facet.range} locale={locale} links={links} />;
  return null;
}

function FacetValues({ facet, locale, links }: { facet: ListingFacet; locale: Locale; links: ListingLinks }) {
  if (!facet.values.length) return null;
  const t = translator(locale);
  return (
    <ul className={`${styles.values} ${facet.display === 'color' ? styles.colorValues : ''}`}>
      {facet.values.map((value, index) => (
        <li key={`${value.label}-${index}`}>
          <Link
            href={listingHref(links.path, value.query, links.keep)}
            scroll={false}
            rel="nofollow"
            className={`${styles.value} ${value.selected ? styles.valueSelected : ''}`}
            data-selected={value.selected}
            data-testid="facet-value"
          >
            <ValueMark hint={facet.display} value={value} />
            <span className={styles.valueLabel}>{value.label}</span>
            {value.count !== null && <span className={styles.valueCount}>{formatNumber(value.count, locale)}</span>}
            {value.selected && <span className="visually-hidden">{t('catalogSelected')}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** How a value looks, by the facet's `display` hint. Unknown hints and missing data → a check box. */
function ValueMark({ hint, value }: { hint: string; value: ListingFacetValue }) {
  const color = hint === 'color' ? swatchColor(value.color) : null;
  if (color) return <span className={styles.swatch} style={{ backgroundColor: color }} aria-hidden="true" />;
  if (hint === 'image' && value.image) {
    // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
    return <img src={value.image} alt="" className={styles.valueImage} loading="lazy" decoding="async" />;
  }
  return <span className={styles.check} aria-hidden="true" />;
}

/**
 * A from/to filter the shopper types. The form sends `priceMin` / `priceMax` (the contract's names)
 * next to the parameters of the facet's `query` and the page's own ones, as hidden fields.
 * Works without JavaScript (a plain GET form); with it, next/form navigates in place.
 */
function RangeForm({ facet, range, locale, links }: { facet: ListingFacet; range: ListingRange; locale: Locale; links: ListingLinks }) {
  const t = translator(locale);
  const id = `facet-${facet.key}`;
  return (
    <Form action={links.path} scroll={false} className={styles.range} key={`${range.query}|${range.selectedMin}|${range.selectedMax}`} data-testid="range-form">
      {formFields(range.query, links.keep).map(([name, value], index) => (
        <input key={`${name}-${index}`} type="hidden" name={name} value={value} />
      ))}
      <div className={styles.rangeInputs}>
        <label htmlFor={`${id}-min`} className={styles.rangeLabel}>
          {t('catalogPriceFrom')}
        </label>
        <input id={`${id}-min`} name="priceMin" type="number" min={0} step="any" inputMode="decimal" defaultValue={range.selectedMin ?? ''} className={styles.rangeInput} />
        <label htmlFor={`${id}-max`} className={styles.rangeLabel}>
          {t('catalogPriceTo')}
        </label>
        <input id={`${id}-max`} name="priceMax" type="number" min={0} step="any" inputMode="decimal" defaultValue={range.selectedMax ?? ''} className={styles.rangeInput} />
      </div>
      {(range.min || range.max) && (
        <p className={styles.rangeBounds} data-testid="range-bounds">
          <Money value={range.min} />
          <span aria-hidden="true"> – </span>
          <Money value={range.max} />
        </p>
      )}
      <button type="submit" className={styles.rangeApply}>
        {t('catalogApply')}
      </button>
    </Form>
  );
}
