'use client';

import { useOptimistic, useState, useTransition, type ReactNode } from 'react';
import type { Locale } from '@/sdk';
import { Icon } from '../ui/Icon';
import styles from './Compare.module.css';

export type CompareActionResult = { ok: true } | { ok: false; message: string };
/** A server action: (locale, productId) → result. Never throws for API errors. */
export interface CompareAction {
  (locale: Locale, productId: number): Promise<CompareActionResult>;
}

export interface CompareColumn {
  productId: number;
  name: string;
  /** The rendered product card */
  card: ReactNode;
}

/** One comparison row from the API: `values[i]` belongs to column i; null = no value. */
export interface CompareRow {
  name: string;
  values: (string | null)[];
}

export interface CompareTableLabels {
  table: string;
  product: string;
  remove: string;
  removed: string;
  noValue: string;
  /** "Comparing {count} of {max} products" */
  note: string;
  /** "Products compared: {count}" (no maximum) */
  noteUnlimited: string;
  error: string;
}

interface CompareTableProps {
  columns: CompareColumn[];
  rows: CompareRow[];
  /** From the API; null = no limit */
  maxItems: number | null;
  locale: Locale;
  labels: CompareTableLabels;
  onRemove: CompareAction;
}

type Status = { tone: 'success' | 'error'; text: string };

/**
 * Products side by side: cards on top, one row per attribute. Removing hides the column at
 * once (optimistic) and brings it back if the API refuses.
 */
export function CompareTable({ columns, rows, maxItems, locale, labels, onRemove }: CompareTableProps) {
  const [hidden, hide] = useOptimistic<number[], number>([], (state, productId) => [...state, productId]);
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = columns.map((column, index) => ({ ...column, index })).filter((column) => !hidden.includes(column.productId));
  const number = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG');
  const note = (maxItems === null ? labels.noteUnlimited : labels.note)
    .replace('{count}', number.format(visible.length))
    .replace('{max}', maxItems === null ? '' : number.format(maxItems));

  function remove(productId: number) {
    setStatus(null);
    startTransition(async () => {
      hide(productId);
      let result: CompareActionResult;
      try {
        result = await onRemove(locale, productId);
      } catch {
        result = { ok: false, message: labels.error };
      }
      setStatus(result.ok ? { tone: 'success', text: labels.removed } : { tone: 'error', text: result.message || labels.error });
    });
  }

  return (
    <div aria-busy={pending}>
      <p className={styles.note} data-testid="compare-note">
        {note}
      </p>
      <div className={styles.status} aria-live="polite" data-testid="compare-status">
        {status && (
          <p role={status.tone === 'error' ? 'alert' : undefined} className={status.tone === 'error' ? styles.error : styles.success}>
            {status.text}
          </p>
        )}
      </div>

      <div className={styles.scroller} role="region" aria-label={labels.table} tabIndex={0} data-testid="compare-scroller">
        <table className={styles.table} data-testid="compare-table">
          <caption className="visually-hidden">{labels.table}</caption>
          <thead>
            <tr>
              <td className={styles.corner}>
                <span className="visually-hidden">{labels.product}</span>
              </td>
              {visible.map((column) => (
                <td key={column.productId} className={styles.product} data-testid="compare-product">
                  {column.card}
                  <button type="button" className={styles.remove} aria-label={`${labels.remove} ${column.name}`} onClick={() => remove(column.productId)}>
                    <Icon name="close" size={16} />
                    {labels.remove}
                  </button>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${rowIndex}-${row.name}`} data-testid="compare-row">
                <th scope="row" className={styles.attribute}>
                  {row.name}
                </th>
                {visible.map((column) => {
                  const value = row.values[column.index] ?? null;
                  return (
                    <td key={column.productId} className={styles.value}>
                      {value ?? (
                        <>
                          <span aria-hidden="true">—</span>
                          <span className="visually-hidden">{labels.noValue}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
