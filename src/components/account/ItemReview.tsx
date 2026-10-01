'use client';

import { useRef, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { WriteReviewResult } from '@/lib/reviews.actions';
import { ReviewDialog, type WriteReviewAction } from './ReviewDialog';
import styles from './Account.module.css';
import ratingStyles from './Rating.module.css';

interface ItemReviewProps {
  locale: Locale;
  orderId: string;
  productId: number;
  productName: string;
  writeReviewAction: WriteReviewAction;
}

/** "Write a review" under an order line (shown only when `order.actions.canReviewProducts`); the thank-you text is the backend's. */
export function ItemReview({ locale, orderId, productId, productName, writeReviewAction }: ItemReviewProps) {
  const t = translator(locale);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<WriteReviewResult | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  if (done) {
    return (
      <p className={styles.success} role="status" data-testid="item-review-done">
        {done.message}
      </p>
    );
  }

  return (
    <>
      <button ref={button} type="button" className={`${styles.textButton} ${ratingStyles.inlineButton}`} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="item-review">
        {t('reviewWrite')}
      </button>
      {open && (
        <ReviewDialog
          locale={locale}
          productId={productId}
          productName={productName}
          orderId={orderId}
          writeReviewAction={writeReviewAction}
          onDone={(result) => {
            setOpen(false);
            setDone(result);
          }}
          onClose={() => {
            setOpen(false);
            button.current?.focus();
          }}
        />
      )}
    </>
  );
}
