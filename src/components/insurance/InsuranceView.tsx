'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import type { InsurancePage, InsuranceProfile, Locale } from '@/sdk';
import { FormFields, type UploadFileAction } from '@/components/content/FormFields';
import { translator } from '@/lib/i18n';
import type { DeleteInsuranceAction, InsuranceFormState, SaveInsuranceAction } from './types';
import styles from './Insurance.module.css';

interface InsuranceViewProps {
  locale: Locale;
  /** `GET /insurance`: the profiles and the form the backend describes. */
  page: InsurancePage;
  saveAction: SaveInsuranceAction;
  deleteAction: DeleteInsuranceAction;
  uploadAction: UploadFileAction;
}

const INITIAL: InsuranceFormState = {};

/**
 * The customer's insurance details as the backend wrote them (the national ID only ever masked, photos
 * only counted), and one form to add or change them. Which fields exist and which are required are the
 * backend's (the store's settings); its answers replace the page.
 */
export function InsuranceView({ locale, page: first, saveAction, deleteAction, uploadAction }: InsuranceViewProps) {
  const t = translator(locale);
  const [page, setPage] = useState(first);
  const [editing, setEditing] = useState<InsuranceProfile | null>(null);
  const [state, action, pending] = useActionState(saveAction, INITIAL);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state.ok && state.page) {
      setPage(state.page);
      setEditing(null);
      setNotice(state.message ?? null);
    }
  }, [state]);

  const errors = state.ok ? {} : (state.fieldErrors ?? {});
  // an edit starts from the company and name on record; numbers and photos left empty stay as stored
  const values = editing ? { companyId: String(editing.company?.id ?? ''), ...(editing.name ? { name: editing.name } : {}) } : state.ok ? {} : state.values;

  function remove(profile: InsuranceProfile) {
    startDelete(async () => {
      const answer = await deleteAction(locale, profile.id);
      setNotice(answer.message);
      if (answer.ok) setPage(answer.page);
    });
  }

  return (
    <div className={styles.stack}>
      {page.hint && <p className={styles.muted}>{page.hint}</p>}
      {notice && (
        <p className={styles.notice} role="status" data-testid="insurance-notice">
          {notice}
        </p>
      )}

      {page.items.length > 0 && (
        <ul className={styles.list} data-testid="insurance-profiles">
          {page.items.map((profile) => (
            <li key={profile.id} className={styles.card} data-testid="insurance-profile">
              <div className={styles.cardHead}>
                {/* eslint-disable-next-line @next/next/no-img-element -- company logos come from the store's CDN */}
                {profile.company?.logo && <img src={profile.company.logo} alt="" className={styles.logo} loading="lazy" decoding="async" />}
                <p className={styles.label}>{profile.label}</p>
              </div>
              <dl className={styles.facts}>
                {profile.nationalId && (
                  <div>
                    <dt>{t('insuranceNationalId')}</dt>
                    <dd>
                      <bdi>{profile.nationalId}</bdi>
                    </dd>
                  </div>
                )}
                {profile.insuranceNumber && (
                  <div>
                    <dt>{t('insuranceMembership')}</dt>
                    <dd>
                      <bdi>{profile.insuranceNumber}</bdi>
                    </dd>
                  </div>
                )}
                <div>
                  <dt>{t('insuranceDocuments')}</dt>
                  <dd>{profile.documents}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => setEditing(profile)} data-testid="insurance-edit">
                  {t('insuranceEdit')}
                </button>
                <button type="button" className={styles.secondary} disabled={deleting} onClick={() => remove(profile)} data-testid="insurance-delete">
                  {t('insuranceDelete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section className={styles.formCard} aria-labelledby="insurance-form-title">
        <h2 id="insurance-form-title" className={styles.heading}>
          {editing ? t('insuranceEditTitle') : t('insuranceAddTitle')}
        </h2>
        {/* a new form for each profile being edited: the inputs start from its values */}
        <form key={editing?.id ?? 'new'} action={action} noValidate className={styles.form} aria-busy={pending || undefined} data-testid="insurance-form">
          <input type="hidden" name="locale" value={locale} />
          {editing && <input type="hidden" name="profileId" value={editing.id} />}
          {!state.ok && state.message && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}
          {editing && <p className={styles.muted}>{t('insuranceEditHint')}</p>}
          <FormFields locale={locale} fields={page.fields} errors={errors} values={values} upload={uploadAction} idPrefix="insurance" />
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending}>
              {pending ? t('insuranceSaving') : t('insuranceSave')}
            </button>
            {editing && (
              <button type="button" className={styles.secondary} onClick={() => setEditing(null)}>
                {t('insuranceCancelEdit')}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
