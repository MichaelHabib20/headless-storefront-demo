'use client';

import { useEffect, useState } from 'react';
import styles from './CookieConsent.module.css';

const KEY = 'sc_cookie_consent';
/** Read by <MarketingTags>: tags wait for this consent, and install on this event without a reload. */
export const COOKIE_CONSENT_KEY = KEY;
export const COOKIE_CONSENT_EVENT = 'sc:cookie-consent';

export function CookieConsent({ labels }: { labels: { text: string; accept: string } }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(KEY) !== 'accepted');
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className={styles.banner} role="region" aria-label={labels.text} data-testid="cookie-consent">
      <p className={styles.text}>{labels.text}</p>
      <button
        type="button"
        className={styles.accept}
        onClick={() => {
          try {
            localStorage.setItem(KEY, 'accepted');
          } catch {
            /* storage blocked: hide for this page view only */
          }
          window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
          setVisible(false);
        }}
      >
        {labels.accept}
      </button>
    </div>
  );
}
