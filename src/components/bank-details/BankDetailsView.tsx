'use client';

import { useActionState } from 'react';
import type { BankDetails, Locale } from '@/sdk';
import { FormFields } from '@/components/content/FormFields';
import { translator } from '@/lib/i18n';
import styles from '@/components/insurance/Insurance.module.css';

/** What saving answers to the page: the backend's message and page, or its reasons per field. */
export interface BankDetailsState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  details?: BankDetails;
}

export type SaveBankDetailsAction = (state: BankDetailsState, form: FormData) => Promise<BankDetailsState>;

const INITIAL: BankDetailsState = {};

/**
 * Where refunds go, as the backend wrote it: what is on record (masked) and the form it describes
 * (bank account or post office: `showWhen`). Saving replaces the details; the backend's answer is shown.
 */
export function BankDetailsView({ locale, details: first, saveAction }: { locale: Locale; details: BankDetails; saveAction: SaveBankDetailsAction }) {
  const t = translator(locale);
  const [state, action, pending] = useActionState(saveAction, INITIAL);
  const details = state.ok && state.details ? state.details : first;
  const errors = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <div className={styles.stack}>
      {details.hint && <p className={styles.muted}>{details.hint}</p>}
      {state.ok && state.message && (
        <p className={styles.notice} role="status" data-testid="bank-details-notice">
          {state.message}
        </p>
      )}
      {details.saved && (
        <section className={styles.card} aria-labelledby="bank-saved-title" data-testid="bank-details-saved">
          <h2 id="bank-saved-title" className={styles.heading}>
            {t('bankDetailsOnRecord')}
          </h2>
          <dl className={styles.facts}>
            {details.saved.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <bdi>{row.value}</bdi>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <section className={styles.formCard} aria-labelledby="bank-form-title">
        <h2 id="bank-form-title" className={styles.heading}>
          {details.saved ? t('bankDetailsReplace') : t('bankDetailsAdd')}
        </h2>
        <form action={action} noValidate className={styles.form} aria-busy={pending || undefined} data-testid="bank-details-form">
          <input type="hidden" name="locale" value={locale} />
          {!state.ok && state.message && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}
          <FormFields locale={locale} fields={details.fields} errors={errors} idPrefix="bank" />
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? t('insuranceSaving') : t('insuranceSave')}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
