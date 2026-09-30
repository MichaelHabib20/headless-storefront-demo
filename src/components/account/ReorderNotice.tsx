'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { takeReorderNotice, type SkippedItems } from './reorder-notice';
import styles from './Account.module.css';

/**
 * On the cart page, after "Order again": says the order's items were added and lists what the API
 * skipped (its names and reasons). Shown once; reading it never writes anything to the backend.
 */
export function ReorderNotice({ locale }: { locale: Locale }) {
  const t = translator(locale);
  const [skipped, setSkipped] = useState<SkippedItems | null>(null);

  useEffect(() => {
    // Read once: a second run (React strict mode in development) finds nothing and keeps the notice.
    const notice = takeReorderNotice();
    if (notice) setSkipped(notice);
  }, []);

  return (
    <div role="status" aria-live="polite">
      {skipped && (
        <div className={styles.notice} data-testid="reorder-notice">
          <p>{t('reorderAdded')}</p>
          {skipped.length > 0 && (
            <>
              <p>{t('reorderSkipped')}</p>
              <ul>
                {skipped.map((item, index) => (
                  <li key={`${index}-${item.name}`} data-testid="reorder-skipped">
                    <strong>{item.name}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
