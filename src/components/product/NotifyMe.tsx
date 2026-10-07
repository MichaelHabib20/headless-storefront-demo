'use client';

import { useEffect, useId, useRef, useState, useTransition, type FormEvent } from 'react';
import type { Locale } from '@/sdk';
import styles from './NotifyMe.module.css';

/**
 * What the notify-me server action answers. `emailError` is the backend's message for the email
 * field (422 `validation_failed` with `fields.email`): the backend decides when an email is needed.
 */
export type NotifyMeActionResult = { ok: true; message: string } | { ok: false; message: string; emailError?: string };

/** The server action (src/app/[locale]/_product/actions.ts). `email` is null unless the shopper typed one. */
export type NotifyMeAction = (locale: Locale, productId: number, email: string | null) => Promise<NotifyMeActionResult>;

export interface NotifyMeLabels {
  button: string;
  email: string;
  /** Shown when the action could not run at all. */
  failed: string;
}

interface NotifyMeProps {
  productId: number;
  locale: Locale;
  action: NotifyMeAction;
  labels: NotifyMeLabels;
}

/**
 * "Tell me when it is back" (shown when `availability.notifyMe`). One click sends the request; the
 * email field appears only when the backend asks for one, and is sent only when the shopper typed
 * one. Every answer (subscribed, already in stock, email needed) is shown as the backend worded it.
 */
export function NotifyMe({ productId, locale, action, labels }: NotifyMeProps) {
  const [askEmail, setAskEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; error: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const emailInput = useRef<HTMLInputElement>(null);
  const id = useId();

  // Move focus to the email field when the backend asked for it (a reaction to the shopper's click).
  useEffect(() => {
    if (emailError) emailInput.current?.focus();
  }, [emailError]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    startTransition(async () => {
      let result: NotifyMeActionResult;
      try {
        result = await action(locale, productId, email.trim() || null);
      } catch {
        result = { ok: false, message: labels.failed };
      }
      if (result.ok) {
        setDone(true);
        setEmailError(null);
        setStatus({ text: result.message, error: false });
      } else if (result.emailError) {
        setAskEmail(true);
        setEmailError(result.emailError);
      } else {
        setStatus({ text: result.message, error: true });
      }
    });
  }

  return (
    <form className={styles.notify} onSubmit={submit} noValidate aria-busy={pending} data-testid="notify-me">
      {!done && (
        <>
          {askEmail && (
            <div className={styles.field}>
              <label htmlFor={`${id}-email`} className={styles.label}>
                {labels.email}
              </label>
              <input
                ref={emailInput}
                id={`${id}-email`}
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                className={styles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? `${id}-error` : undefined}
              />
              {emailError && (
                <p id={`${id}-error`} className={styles.fieldError}>
                  {emailError}
                </p>
              )}
            </div>
          )}
          <button type="submit" className={styles.button} aria-disabled={pending || undefined} disabled={pending}>
            {labels.button}
          </button>
        </>
      )}
      <p className={status?.error ? `${styles.status} ${styles.error}` : styles.status} role="status">
        {status?.text}
      </p>
    </form>
  );
}
