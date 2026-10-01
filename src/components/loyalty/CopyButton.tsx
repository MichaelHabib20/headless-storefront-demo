'use client';

import { useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './Loyalty.module.css';

/** Copies a text the backend wrote (a voucher code, the referral code or its invite text) to the clipboard. */
export function CopyButton({ locale, text, label = 'loyaltyCopy' }: { locale: Locale; text: string; label?: 'loyaltyCopy' | 'loyaltyCopyInvite' }) {
  const t = translator(locale);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button type="button" className={styles.secondary} onClick={copy} data-testid={label === 'loyaltyCopy' ? 'copy' : 'copy-invite'}>
      {copied ? t('loyaltyCopied') : t(label)}
    </button>
  );
}
