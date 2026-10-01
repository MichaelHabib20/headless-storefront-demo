'use client';

import { useEffect, useState } from 'react';
import type { Locale, Target } from '@/sdk';
import { TargetLink } from '../ui/TargetLink';
import styles from './CookieConsent.module.css';

const KEY = 'sc_cookie_consent';

interface CookieConsentProps {
  labels: { text: string; accept: string };
  /** shell: the store's cookie (or privacy) policy page from `Layout.legal`, linked as "Learn more". */
  policy?: { target: Target; locale: Locale; label: string } | null;
}

export function CookieConsent({ labels, policy }: CookieConsentProps) {
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
      <p className={styles.text}>
        {labels.text}
        {policy && (
          <>
            {' '}
            <TargetLink target={policy.target} locale={policy.locale} className={styles.policy}>
              {policy.label}
            </TargetLink>
          </>
        )}
      </p>
      <button
        type="button"
        className={styles.accept}
        onClick={() => {
          try {
            localStorage.setItem(KEY, 'accepted');
          } catch {
            /* storage blocked: hide for this page view only */
          }
          setVisible(false);
        }}
      >
        {labels.accept}
      </button>
    </div>
  );
}
