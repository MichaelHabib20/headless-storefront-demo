'use client';

import { useRef } from 'react';
import type { Checkout, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import styles from './Checkout.module.css';

interface PrescriptionSectionProps {
  /** `checkout.requirements.prescription`: whether one is needed and the files the backend has. */
  prescription: Checkout['requirements']['prescription'];
  locale: Locale;
  busy: boolean;
  /** Uploads the file; the backend then lists it in the next checkout. */
  onUpload: (file: File) => void;
  onRemove: (fileId: string) => void;
}

/**
 * Prescription upload, shown only when the backend asks for one. The list is the backend's
 * (`files`): a file is on it after the upload and the next computed checkout, never before.
 */
export function PrescriptionSection({ prescription, locale, busy, onUpload, onRemove }: PrescriptionSectionProps) {
  const t = translator(locale);
  const input = useRef<HTMLInputElement>(null);
  if (!prescription.required) return null;

  return (
    <section className={styles.section} aria-labelledby="checkout-prescription-title" data-testid="checkout-prescription">
      <div className={styles.sectionHead}>
        <h2 id="checkout-prescription-title" className={styles.sectionTitle}>
          {t('checkoutPrescriptionTitle')}
        </h2>
      </div>

      {prescription.files.length > 0 && (
        <ul className={styles.files}>
          {prescription.files.map((file) => (
            <li key={file.id} className={styles.file} data-testid="prescription-file">
              <span className={styles.fileName}>{file.name}</span>
              <button type="button" className={styles.textLink} disabled={busy} onClick={() => onRemove(file.id)} aria-label={`${t('checkoutPrescriptionRemove')}: ${file.name}`}>
                {t('checkoutPrescriptionRemove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className={styles.field}>
        <span>{t('checkoutPrescriptionUpload')}</span>
        <input
          ref={input}
          className={styles.fileInput}
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            if (input.current) input.current.value = '';
          }}
        />
        <small>{t('checkoutPrescriptionHint')}</small>
      </label>
    </section>
  );
}
