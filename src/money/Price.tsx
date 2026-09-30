import type { CSSProperties } from 'react';
import type { Locale, Price as PriceValue } from '@/sdk';
import { priceLabels } from './messages';
import type { MoneyTag } from './Money';

/** Class names for the parts of a price. Every part is optional. */
export interface PriceClassNames {
  /** What the shopper pays. */
  amount?: string;
  /** Added to `amount` when there is an old price (e.g. a sale colour). */
  sale?: string;
  /** The old price, struck through. */
  compareAt?: string;
  /** The discount text, e.g. "10 %". */
  discount?: string;
}

export interface PriceProps {
  /** A `Price` from the API. `null` (the store hides prices) renders nothing. */
  price: PriceValue | null | undefined;
  /** Language of the screen-reader labels ("now" / "was"). */
  locale: Locale;
  /** The element around the parts. Default `span`. */
  as?: MoneyTag;
  className?: string;
  classNames?: PriceClassNames;
  /** Show the discount text inside the price. Set `false` when <DiscountLabel> is placed elsewhere. */
  showDiscount?: boolean;
  'data-testid'?: string;
}

/** Hidden on screen, read by screen readers. Inline so the folder needs no stylesheet. */
const SCREEN_READER_ONLY: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  padding: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

const join = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ') || undefined;

/**
 * A product price exactly as the backend wrote it: what the shopper pays (`display`), the old
 * price struck through (`compareAtDisplay`) and the discount (`discountLabel`) when there are
 * ones. Nothing is formatted or computed here. Parts come in reading order, so RTL just works.
 */
export function Price({ price, locale, as: Tag = 'span', className, classNames = {}, showDiscount = true, 'data-testid': testId }: PriceProps) {
  if (!price) return null;
  const labels = priceLabels(locale);
  const hasOldPrice = price.compareAtDisplay !== null;

  return (
    <Tag className={className} data-testid={testId}>
      <span className={join(classNames.amount, hasOldPrice ? classNames.sale : undefined)}>
        {hasOldPrice && (
          <>
            <span style={SCREEN_READER_ONLY}>{labels.now}</span>{' '}
          </>
        )}
        {price.display}
      </span>
      {/* the spaces keep the parts apart for screen readers and inline layouts; flex ignores them */}
      {hasOldPrice && (
        <>
          {' '}
          <s className={classNames.compareAt}>
            <span style={SCREEN_READER_ONLY}>{labels.was}</span> {price.compareAtDisplay}
          </s>
        </>
      )}
      {showDiscount && price.discountLabel !== null && (
        <>
          {' '}
          <span className={classNames.discount}>{price.discountLabel}</span>
        </>
      )}
    </Tag>
  );
}

export interface DiscountLabelProps {
  /** A `Price` from the API. Renders nothing when it is null or has no discount. */
  price: PriceValue | null | undefined;
  /** The element to render. Default `span`. */
  as?: MoneyTag;
  className?: string;
  'data-testid'?: string;
}

/** The discount text alone (e.g. "10 %"), for a badge away from the price. */
export function DiscountLabel({ price, as: Tag = 'span', className, 'data-testid': testId }: DiscountLabelProps) {
  if (!price || price.discountLabel === null) return null;
  return (
    <Tag className={className} data-testid={testId}>
      {price.discountLabel}
    </Tag>
  );
}
