'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState } from 'react';
import type { Locale, ReviewAccess } from '@/sdk';
import { translator } from '@/lib/i18n';
import type { WriteReviewResult } from '@/lib/reviews.actions';
import { routes } from '@/lib/routing';
import { ReviewDialog, type WriteReviewAction } from '../account/ReviewDialog';
import styles from './ProductReviews.module.css';

interface WriteReviewProps {
  locale: Locale;
  productId: number;
  productName: string;
  /** `ProductReviewsPage.write`: whether and how this shopper may write a review. */
  access: ReviewAccess;
  writeReviewAction: WriteReviewAction;
}

/**
 * The entry point to write a review on the product page, drawn from `write`: the button when the
 * backend allows it, a sign-in link when it wants a session, or its sentence (e.g. "review it from
 * a delivered order"). Nothing is decided here.
 */
export function WriteReview({ locale, productId, productName, access, writeReviewAction }: WriteReviewProps) {
  const t = translator(locale);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<WriteReviewResult | null>(null);
  const button = useRef<HTMLButtonElement>(null);

  if (!access.enabled) return null;

  if (done) {
    return (
      <p className={styles.writeNote} role="status" data-testid="write-review-done">
        {done.message}
      </p>
    );
  }

  if (access.requiresSignIn) {
    return (
      <p className={styles.writeNote} data-testid="write-review-sign-in">
        {access.message}{' '}
        <Link href={routes.signIn(locale, pathname)} className={styles.writeLink}>
          {t('reviewSignIn')}
        </Link>
      </p>
    );
  }

  if (access.requiresOrder) {
    return (
      <p className={styles.writeNote} data-testid="write-review-order">
        {access.message}
      </p>
    );
  }

  return (
    <div className={styles.write}>
      <button ref={button} type="button" className={styles.writeButton} onClick={() => setOpen(true)} aria-haspopup="dialog" data-testid="write-review">
        {t('reviewWrite')}
      </button>
      {open && (
        <ReviewDialog
          locale={locale}
          productId={productId}
          productName={productName}
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
    </div>
  );
}
