'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale, Popup } from '@/sdk';
import { pickPopup, remember, type PopupMemory } from '@/lib/popup';
import { Icon } from '../ui/Icon';
import { ResponsiveImage } from '../ui/ResponsiveImage';
import { TargetLink } from '../ui/TargetLink';
import styles from './PopupHost.module.css';

const LOCAL_KEY = 'sc_popups_shown_at';
const SESSION_KEY = 'sc_popups_session';

function readMemory(): PopupMemory {
  try {
    return {
      shownAt: JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}'),
      sessionShown: JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]'),
    };
  } catch {
    return { shownAt: {}, sessionShown: [] };
  }
}

function writeMemory(memory: PopupMemory) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(memory.shownAt));
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(memory.sessionShown));
  } catch {
    /* storage blocked: the popup may show again, which is acceptable */
  }
}

/** Shows at most one merchant popup per page view, respecting its frequency. */
export function PopupHost({ popups, locale, closeLabel, bannerLabel }: { popups: Popup[]; locale: Locale; closeLabel: string; /** the image link's name when the popup has no alt text or title */ bannerLabel: string }) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!popups.length) return;
    const now = new Date();
    const memory = readMemory();
    const next = pickPopup(popups, memory, now);
    if (next) {
      writeMemory(remember(next, memory, now));
      setPopup(next);
    }
  }, [popups]);

  useEffect(() => {
    if (popup && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [popup]);

  if (!popup) return null;

  return (
    <dialog ref={dialog} className={styles.dialog} aria-label={popup.title ?? closeLabel} onClose={() => setPopup(null)} data-testid="popup">
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={() => dialog.current?.close()}>
        <Icon name="close" />
      </button>
      <TargetLink target={popup.target} locale={locale} className={styles.link}>
        <ResponsiveImage image={{ ...popup.image, alt: popup.image.alt?.trim() || popup.title?.trim() || bannerLabel }} />
      </TargetLink>
      {(popup.title || popup.description) && (
        <div className={styles.body}>
          {popup.title && <h2 className={styles.title}>{popup.title}</h2>}
          {popup.description && <p className={styles.description}>{popup.description}</p>}
        </div>
      )}
    </dialog>
  );
}
