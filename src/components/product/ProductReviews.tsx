import type { CSSProperties, ReactNode } from 'react';
import type { Locale, ProductReviewsPage } from '@/sdk';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { Pagination } from '../ui/Pagination';
import { fillTemplate, ratingLabel, ratingText, reviewDate } from './details';
import { Stars } from './Stars';
import styles from './ProductReviews.module.css';

/** The id of the reviews block: the rating near the title links here, and page links scroll here. */
export const REVIEWS_ID = 'reviews';

interface ProductReviewsProps {
  reviews: ProductReviewsPage;
  locale: Locale;
  /** The product page URL; review pages add `?page=`. */
  baseHref: string;
  /** The "write a review" entry point (`<WriteReview>`), drawn from `reviews.write`. */
  writeForm?: ReactNode;
}

/**
 * The rating summary and one page of reviews, exactly as the backend sent them: the average, the
 * share of each star count (`percent`, used as the bar width) and the pages. Nothing is counted
 * here. When the store switched reviews off (`enabled: false`) nothing is shown.
 */
export function ProductReviews({ reviews, locale, baseHref, writeForm }: ProductReviewsProps) {
  if (!reviews.enabled) return null;
  const t = translator(locale);
  const { summary, items, pagination } = reviews;

  return (
    <section id={REVIEWS_ID} className={styles.reviews} aria-labelledby={`${REVIEWS_ID}-title`} data-testid="product-reviews">
      <div className={styles.titleRow}>
        <h2 id={`${REVIEWS_ID}-title`} className={styles.title}>
          {t('productReviewsTitle')}
        </h2>
        {writeForm}
      </div>

      <div className={styles.layout}>
        {summary && (
          <div className={styles.summary} data-testid="reviews-summary">
            <p className={styles.average}>
              <span className={styles.averageNumber} data-testid="reviews-average">
                {ratingText(summary.average, locale)}
              </span>
              <Stars value={summary.average} label={ratingLabel(summary.average, locale, t)} className={styles.bigStars} />
            </p>
            <p className={styles.basedOn}>
              {summary.count === 1 ? t('productReviewsBasedOnOne') : fillTemplate(t('productReviewsBasedOn'), { count: formatNumber(summary.count, locale) })}
            </p>
            <ul className={styles.distribution}>
              {summary.distribution.map((row) => (
                <li key={row.stars} className={styles.row} data-testid="reviews-distribution-row">
                  <span className={styles.rowLabel}>
                    {row.stars === 1 ? t('productReviewsStarsOne') : fillTemplate(t('productReviewsStars'), { stars: formatNumber(row.stars, locale) })}
                  </span>
                  <span className={styles.bar} aria-hidden="true">
                    <span className={styles.fill} style={{ '--review-share': `${row.percent}%` } as CSSProperties} />
                  </span>
                  <span className={styles.rowCount}>{formatNumber(row.count, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.listColumn}>
          {items.length ? (
            <ol className={styles.list}>
              {items.map((review) => (
                <li key={review.id} className={styles.review} data-testid="review">
                  <div className={styles.reviewHead}>
                    <Stars value={review.rating} label={ratingLabel(review.rating, locale, t)} />
                    <span className={styles.author}>{review.author ?? t('productReviewAnonymous')}</span>
                    <time className={styles.date} dateTime={review.createdAt}>
                      {reviewDate(review.createdAt, locale)}
                    </time>
                  </div>
                  {review.comment && <p className={styles.comment}>{review.comment}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.empty}>{t('productReviewsEmpty')}</p>
          )}

          <Pagination
            pagination={pagination}
            baseHref={baseHref}
            locale={locale}
            fragment={REVIEWS_ID}
            labels={{ nav: t('productReviewsPages'), previous: t('previous'), next: t('next'), page: t('productReviewsPage') }}
          />
        </div>
      </div>
    </section>
  );
}

/** Shown in place of the reviews when they could not be loaded; the rest of the page still works. */
export function ProductReviewsUnavailable({ locale }: { locale: Locale }) {
  const t = translator(locale);
  return (
    <section id={REVIEWS_ID} className={styles.reviews} aria-labelledby={`${REVIEWS_ID}-title`} data-testid="product-reviews">
      <h2 id={`${REVIEWS_ID}-title`} className={styles.title}>
        {t('productReviewsTitle')}
      </h2>
      <p className={styles.empty}>{t('productReviewsUnavailable')}</p>
    </section>
  );
}
