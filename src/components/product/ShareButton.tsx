'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { Icon } from '../ui/Icon';
import styles from './ShareButton.module.css';

interface ShareButtonProps {
  locale: Locale;
  /** What is shared: the product name and its page (the canonical URL is the page's own address). */
  title: string;
  /** The absolute page URL when known (from the server); otherwise the browser's current address is used. */
  url?: string | null;
}

/**
 * Share dialog for a product page (shown only when `Layout.features.share`). Uses the Web Share API
 * where the browser has it; otherwise a small menu with WhatsApp, Facebook, X and "copy link". The
 * links go to the networks' share endpoints with the page URL — nothing about the product is decided here.
 */
export function ShareButton({ locale, title, url = null }: ShareButtonProps) {
  const t = translator(locale);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const pageUrl = () => url || window.location.href;

  async function share() {
    if (canShare) {
      try {
        await navigator.share({ title, url: pageUrl() });
        return;
      } catch {
        // dismissed, or the browser refused: fall through to the menu
      }
    }
    setOpen((value) => !value);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(pageUrl());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const encoded = () => encodeURIComponent(pageUrl());
  const text = encodeURIComponent(title);

  return (
    <div ref={root} className={styles.share} data-testid="share">
      <button type="button" className={styles.button} onClick={share} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId}>
        <Icon name="link" size={18} />
        {t('share')}
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label={t('shareTitle')} className={styles.menu} data-testid="share-menu">
          <a role="menuitem" className={styles.item} href={`https://wa.me/?text=${text}%20${encoded()}`} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={18} />
            {t('shareWhatsapp')}
          </a>
          <a role="menuitem" className={styles.item} href={`https://www.facebook.com/sharer/sharer.php?u=${encoded()}`} target="_blank" rel="noopener noreferrer">
            <Icon name="facebook" size={18} />
            {t('shareFacebook')}
          </a>
          <a role="menuitem" className={styles.item} href={`https://twitter.com/intent/tweet?text=${text}&url=${encoded()}`} target="_blank" rel="noopener noreferrer">
            <Icon name="x" size={18} />
            {t('shareX')}
          </a>
          <button role="menuitem" type="button" className={styles.item} onClick={copy}>
            <Icon name="link" size={18} />
            {copied ? t('shareCopied') : t('shareCopy')}
          </button>
        </div>
      )}
      <span className="visually-hidden" aria-live="polite">
        {copied ? t('shareCopied') : ''}
      </span>
    </div>
  );
}
