'use client';

import Link from 'next/link';
import { useOptimistic, useState, useTransition, type ReactNode } from 'react';
import type { Locale } from '@/sdk';
import { Icon } from '../ui/Icon';
import styles from './Wishlist.module.css';

export type WishlistActionResult = { ok: true } | { ok: false; message: string };
/** A server action: (locale, productId) → result. Never throws for API errors. */
export interface WishlistAction {
  (locale: Locale, productId: number): Promise<WishlistActionResult>;
}

export interface WishlistEntry {
  productId: number;
  name: string;
  /** From the API (`purchase.canAddToCart`); the UI never decides this itself. */
  canAddToCart: boolean;
  /** The rendered product card */
  card: ReactNode;
}

export interface WishlistGridLabels {
  remove: string;
  moveToCart: string;
  removed: string;
  moved: string;
  viewCart: string;
  /** Shown when the action fails without a message (e.g. the connection dropped) */
  error: string;
}

interface WishlistGridProps {
  entries: WishlistEntry[];
  locale: Locale;
  cartHref: string;
  labels: WishlistGridLabels;
  onRemove: WishlistAction;
  onMoveToCart: WishlistAction;
}

type Status = { tone: 'success'; text: string; cart: boolean } | { tone: 'error'; text: string };

/**
 * Wishlist items with Remove / Move to cart. Items disappear at once (optimistic) and come
 * back if the API refuses; the server re-renders the page with the real list afterwards.
 */
export function WishlistGrid({ entries, locale, cartHref, labels, onRemove, onMoveToCart }: WishlistGridProps) {
  const [visible, hide] = useOptimistic(entries, (state, productId: number) => state.filter((entry) => entry.productId !== productId));
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();
  const removed: Status = { tone: 'success', text: labels.removed, cart: false };
  const moved: Status = { tone: 'success', text: labels.moved, cart: true };

  function run(productId: number, action: WishlistAction, success: Status) {
    setStatus(null);
    startTransition(async () => {
      hide(productId);
      let result: WishlistActionResult;
      try {
        result = await action(locale, productId);
      } catch {
        result = { ok: false, message: labels.error };
      }
      setStatus(result.ok ? success : { tone: 'error', text: result.message || labels.error });
    });
  }

  return (
    <div aria-busy={pending}>
      <div className={styles.status} aria-live="polite" data-testid="wishlist-status">
        {status?.tone === 'error' && (
          <p role="alert" className={styles.error}>
            {status.text}
          </p>
        )}
        {status?.tone === 'success' && (
          <p className={styles.success}>
            {status.text}
            {status.cart && (
              <Link href={cartHref} className={styles.statusLink}>
                {labels.viewCart}
              </Link>
            )}
          </p>
        )}
      </div>

      <ul className={styles.grid} data-testid="wishlist-grid">
        {visible.map((entry) => (
          <li key={entry.productId} className={styles.item} data-testid="wishlist-item">
            {entry.card}
            <button type="button" className={styles.remove} aria-label={`${labels.remove} ${entry.name}`} onClick={() => run(entry.productId, onRemove, removed)}>
              <Icon name="close" size={18} />
            </button>
            <button
              type="button"
              className={styles.moveToCart}
              aria-label={`${labels.moveToCart} ${entry.name}`}
              disabled={!entry.canAddToCart}
              onClick={() => run(entry.productId, onMoveToCart, moved)}
            >
              {labels.moveToCart}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
