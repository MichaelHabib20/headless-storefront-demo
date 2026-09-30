'use client';

import { Fragment, useState, type ReactNode } from 'react';
import styles from './Notifications.module.css';

type Filter = 'all' | 'unread';
const FILTERS: readonly Filter[] = ['all', 'unread'];

export interface NotificationEntry {
  id: number;
  /** `read` from the API for this shopper. */
  read: boolean;
  /** The rendered notification (a <NotificationItem>, i.e. an <li>). */
  item: ReactNode;
}

interface NotificationsFilterProps {
  /** The notifications of the current page, in the order the API sent them. */
  entries: NotificationEntry[];
  labels: { group: string; all: string; unread: string; noUnread: string };
}

/**
 * "All / Unread only" for the notifications already on this page. Display only: it hides the
 * items the API says are `read` and keeps the API order. It never marks anything as read,
 * counts anything or calls the API (GET /notifications has no unread filter).
 */
export function NotificationsFilter({ entries, labels }: NotificationsFilterProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const shown = filter === 'unread' ? entries.filter((entry) => !entry.read) : entries;

  return (
    <>
      <div className={styles.toolbar}>
        <div role="radiogroup" aria-label={labels.group} className={styles.filter} data-testid="notifications-filter">
          {FILTERS.map((value) => (
            <label key={value} className={styles.filterOption}>
              <input
                type="radio"
                name="notifications-filter"
                value={value}
                checked={filter === value}
                onChange={() => setFilter(value)}
                className={styles.filterInput}
              />
              <span className={styles.filterText}>{labels[value]}</span>
            </label>
          ))}
        </div>
      </div>

      {shown.length > 0 ? (
        <ul className={styles.list}>
          {shown.map((entry) => (
            <Fragment key={entry.id}>{entry.item}</Fragment>
          ))}
        </ul>
      ) : (
        <p className={styles.filterEmpty} role="status" data-testid="notifications-filter-empty">
          {labels.noUnread}
        </p>
      )}
    </>
  );
}
