'use client';

import Link from 'next/link';
import { useActionState, useId } from 'react';
import type { Locale, PrescriptionForm as PrescriptionFormData } from '@/sdk';
import { FormFields, type UploadFileAction } from '@/components/content/FormFields';
import { RichText } from '@/components/ui/RichText';
import { translator } from '@/lib/i18n';
import { prescriptionStepHref } from '@/lib/routing';
import type { PrescriptionFormState, SendPrescriptionAction } from './types';
import styles from './Prescriptions.module.css';

const INITIAL: PrescriptionFormState = {};

interface PrescriptionFormProps {
  locale: Locale;
  /** `GET /prescriptions/form`: texts, fields, addresses, blockers — drawn as they are. */
  form: PrescriptionFormData;
  sendAction: SendPrescriptionAction;
  uploadAction: UploadFileAction;
}

/**
 * The prescription form the backend describes. While it has `blockers` (no address, phone to
 * verify...) the form is not shown: each blocker's message and the page that clears it are. The
 * address list, the fields and every rule are the API's; its 422 messages show under the fields.
 */
export function PrescriptionForm({ locale, form, sendAction, uploadAction }: PrescriptionFormProps) {
  const t = translator(locale);
  const [state, action, pending] = useActionState(sendAction, INITIAL);
  const addressLegend = useId();
  const errors = state.fieldErrors ?? {};

  return (
    <section className={styles.formCard} aria-labelledby="prescription-form-title" data-testid="prescription-form">
      <h2 id="prescription-form-title" className={styles.cardTitle}>
        {form.title}
      </h2>
      <RichText value={form.description} className={styles.description} data-testid="prescription-description" />
      {form.video && (
        <a href={form.video.url} target="_blank" rel="noopener noreferrer" className={styles.video}>
          {t('prescriptionsVideo')}
        </a>
      )}

      {!form.canSend ? (
        <ul className={styles.blockers} data-testid="prescription-blockers">
          {form.blockers.map((blocker) => {
            const href = prescriptionStepHref(locale, blocker.code);
            const label = blocker.code === 'add_address' ? t('prescriptionsAddAddressLink') : blocker.code === 'verify_phone' ? t('prescriptionsVerifyPhoneLink') : t('prescriptionsAddPhoneLink');
            return (
              <li key={blocker.code} className={styles.blocker} data-code={blocker.code}>
                <p>{blocker.message}</p>
                {href && (
                  <Link href={href} className={styles.blockerLink}>
                    {label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : state.ok ? (
        <p className={styles.success} role="status" data-testid="prescription-sent">
          {state.message}
        </p>
      ) : (
        <form action={action} noValidate className={styles.form} aria-busy={pending || undefined}>
          <input type="hidden" name="locale" value={locale} />
          {state.message && (
            <p className={styles.error} role="alert">
              {state.message}
            </p>
          )}
          <fieldset className={styles.addresses} aria-describedby={errors.addressId ? `${addressLegend}-error` : undefined}>
            <legend id={addressLegend}>{t('prescriptionsAddress')}</legend>
            {form.addresses.map((address) => (
              <label key={address.id} className={styles.address}>
                <input type="radio" name="addressId" value={address.id} defaultChecked={address.selected} required />
                <span>{address.label}</span>
              </label>
            ))}
            <Link href={prescriptionStepHref(locale, 'add_address') ?? '#'} className={styles.addAddress}>
              {t('prescriptionsAddAddressLink')}
            </Link>
            {errors.addressId && (
              <p id={`${addressLegend}-error`} className={styles.fieldError}>
                {errors.addressId}
              </p>
            )}
          </fieldset>
          <FormFields locale={locale} fields={form.fields} errors={errors} values={state.values} upload={uploadAction} idPrefix="prescription" />
          <button type="submit" className={styles.primary} disabled={pending}>
            {pending ? t('prescriptionsSending') : t('prescriptionsSend')}
          </button>
        </form>
      )}
    </section>
  );
}
