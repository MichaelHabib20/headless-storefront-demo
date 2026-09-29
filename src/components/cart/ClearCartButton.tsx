import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './CartView.module.css';

/** "Clear cart" with an inline confirmation step (no browser dialog). */
export function ClearCartButton({ locale, disabled = false, onConfirm }: { locale: Locale; disabled?: boolean; onConfirm: () => void }) {
  const t = translator(locale);
  const [confirming, setConfirming] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) cancel.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <button type="button" className={styles.textButton} disabled={disabled} onClick={() => setConfirming(true)}>
        {t('cartClear')}
      </button>
    );
  }

  return (
    <div className={styles.confirm} role="group" aria-label={t('cartClear')}>
      <span className={styles.confirmText}>{t('cartClearConfirm')}</span>
      <button
        type="button"
        className={styles.textButton}
        disabled={disabled}
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {t('cartClearYes')}
      </button>
      <button ref={cancel} type="button" className={styles.textButton} onClick={() => setConfirming(false)}>
        {t('cartClearCancel')}
      </button>
    </div>
  );
}
