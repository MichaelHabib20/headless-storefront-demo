'use client';

import Link from 'next/link';
import { useId, useState, type FormEvent } from 'react';
import type { Checkout, CheckoutContactInput, CheckoutSettings, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import type { ContactResult } from './types';
import styles from './Checkout.module.css';

interface ContactSectionProps {
  checkout: Checkout;
  /** `guestEmail` says whether the email field is shown and needed. */
  settings: Pick<CheckoutSettings, 'guestEmail'>;
  locale: Locale;
  /** Another change is on its way to the backend. */
  busy: boolean;
  /** Saves a guest's contact details; the answer is the new checkout or the backend's field messages. */
  onSave: (contact: CheckoutContactInput) => Promise<ContactResult>;
}

type FieldName = 'firstName' | 'lastName' | 'phone' | 'email';

/**
 * Who is ordering, as the backend knows it (`checkout.contact`). A guest fills a small form;
 * when the backend wants an account (`missing: sign_in`) its message is shown with a sign-in
 * link that comes back to checkout. The form's rules are the backend's: it answers per field.
 */
export function ContactSection({ checkout, settings, locale, busy, onSave }: ContactSectionProps) {
  const t = translator(locale);
  const formId = useId();
  const { contact } = checkout;
  const signIn = checkout.missing.find((notice) => notice.code === 'sign_in');
  const hasContact = Boolean(contact.name || contact.phone);

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<FieldName, string>>({ firstName: '', lastName: '', phone: contact.phone ?? '', email: contact.email ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const signInHref = routes.signIn(locale, 'checkout');
  const showForm = contact.isGuest && !signIn && (editing || !hasContact);
  const showEmail = settings.guestEmail !== 'hidden';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrors({});
    setMessage(null);
    const result = await onSave({ firstName: values.firstName, lastName: values.lastName, phone: values.phone, email: showEmail && values.email.trim() ? values.email : null });
    setSaving(false);
    if (result.ok) {
      setEditing(false);
      return;
    }
    setErrors(result.fieldErrors ?? {});
    setMessage(result.message ?? null);
  }

  const field = (name: FieldName, label: string, type: string, autoComplete: string, hint?: string) => (
    <div className={styles.field}>
      <label htmlFor={`${formId}-${name}`}>
        {label} {hint && <small>{hint}</small>}
      </label>
      <input
        id={`${formId}-${name}`}
        className={styles.input}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={values[name]}
        onChange={(event) => setValues((current) => ({ ...current, [name]: event.target.value }))}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={errors[name] ? `${formId}-${name}-error` : undefined}
      />
      {errors[name] && (
        <span id={`${formId}-${name}-error`} className={styles.fieldError}>
          {errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <section className={styles.section} aria-labelledby="checkout-contact-title" data-testid="checkout-contact">
      <div className={styles.sectionHead}>
        <h2 id="checkout-contact-title" className={styles.sectionTitle}>
          {t('checkoutContactTitle')}
        </h2>
        {contact.isGuest && !signIn && hasContact && !editing && (
          <button type="button" className={styles.textLink} onClick={() => setEditing(true)}>
            {t('checkoutContactEdit')}
          </button>
        )}
      </div>

      {signIn && (
        <div className={styles.prompt} data-testid="checkout-sign-in">
          <p>{signIn.message}</p>
          <Link href={signInHref} className={styles.button}>
            {t('checkoutSignIn')}
          </Link>
        </div>
      )}

      {!signIn && !showForm && (
        <dl className={styles.contact} data-testid="checkout-contact-details">
          {contact.name && (
            <>
              <dt>{t('checkoutContactName')}</dt>
              <dd>{contact.name}</dd>
            </>
          )}
          {contact.phone && (
            <>
              <dt>{t('checkoutContactPhone')}</dt>
              <dd>{contact.phone}</dd>
            </>
          )}
          {contact.email && (
            <>
              <dt>{t('checkoutContactEmail')}</dt>
              <dd>{contact.email}</dd>
            </>
          )}
        </dl>
      )}

      {showForm && (
        <form className={styles.form} onSubmit={submit} noValidate data-testid="checkout-contact-form">
          {message && (
            <p className={styles.alert} role="alert">
              {message}
            </p>
          )}
          <div className={styles.formRow}>
            {field('firstName', t('checkoutContactFirstName'), 'text', 'given-name')}
            {field('lastName', t('checkoutContactLastName'), 'text', 'family-name')}
          </div>
          <div className={styles.formRow}>
            {field('phone', t('checkoutContactPhone'), 'tel', 'tel')}
            {showEmail && field('email', t('checkoutContactEmail'), 'email', 'email', settings.guestEmail === 'optional' ? t('checkoutContactOptional') : undefined)}
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.button} disabled={saving || busy} aria-busy={saving}>
              {t('checkoutContactSave')}
            </button>
            {hasContact && (
              <button type="button" className={styles.textLink} onClick={() => setEditing(false)}>
                {t('checkoutContactCancel')}
              </button>
            )}
            <span className={styles.muted}>
              {t('checkoutSignInHint')} <Link href={signInHref}>{t('checkoutSignIn')}</Link>
            </span>
          </div>
        </form>
      )}
    </section>
  );
}
