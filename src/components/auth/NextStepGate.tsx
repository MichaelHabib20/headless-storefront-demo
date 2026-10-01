'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import type { NextStep } from '@/sdk';
import styles from './NextStepGate.module.css';

interface NextStepGateProps {
  /** `Me.next` of this request, decided by the backend on every call. */
  next: NextStep | null | undefined;
  hrefs: { verifyPhone: string; completeProfile: string; waitingApproval: string };
  labels: { verifyBanner: string; verifyLink: string; dismiss: string; completeBanner: string; completeLink: string; waitingTitle: string; waitingText: string; waitingLink: string };
  children: ReactNode;
}

const DISMISSED_KEY = 'sc_verify_phone_dismissed';
/** Pages that stay reachable while the account waits for approval (second path segment). */
const OPEN_SECTIONS = new Set(['waiting-approval', 'sign-in', 'sign-up', 'forgot-password', 'reset-password', 'verify-phone', 'verify-email', 'pages']);

/**
 * What the shopper must do before going on, from `Me.next`:
 * - `waiting_approval`: the store approves accounts by hand — the shop is replaced by the waiting
 *   notice on every page but the auth pages and the CMS pages (the backend already sends no sections
 *   or prices to an unapproved customer; this is the matching storefront gate).
 * - `verify_phone`: a dismissible banner (shopping is allowed meanwhile).
 * - `complete_profile`: a banner that stays until the profile is complete.
 */
export function NextStepGate({ next, hrefs, labels, children }: NextStepGateProps) {
  const pathname = usePathname();
  const section = pathname.split('/')[2] ?? '';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.sessionStorage.getItem(DISMISSED_KEY) === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (next === 'waiting_approval' && !OPEN_SECTIONS.has(section)) {
    return (
      <div className={`container ${styles.waiting}`} role="status" data-testid="approval-gate">
        <h1 className={styles.waitingTitle}>{labels.waitingTitle}</h1>
        <p className={styles.waitingText}>{labels.waitingText}</p>
        <Link href={hrefs.waitingApproval} className={styles.button}>
          {labels.waitingLink}
        </Link>
      </div>
    );
  }

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // private mode: the banner shows again on the next page
    }
    setDismissed(true);
  };

  return (
    <>
      {next === 'verify_phone' && !dismissed && section !== 'verify-phone' && (
        <div className={styles.banner} role="status" data-testid="verify-phone-banner">
          <span>{labels.verifyBanner}</span>
          <Link href={hrefs.verifyPhone} className={styles.bannerLink}>
            {labels.verifyLink}
          </Link>
          <button type="button" className={styles.dismiss} onClick={dismiss} aria-label={labels.dismiss}>
            ×
          </button>
        </div>
      )}
      {next === 'complete_profile' && section !== 'account' && (
        <div className={styles.banner} role="status" data-testid="complete-profile-banner">
          <span>{labels.completeBanner}</span>
          <Link href={hrefs.completeProfile} className={styles.bannerLink}>
            {labels.completeLink}
          </Link>
        </div>
      )}
      {children}
    </>
  );
}
