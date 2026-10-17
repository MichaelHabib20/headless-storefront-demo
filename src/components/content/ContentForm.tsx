'use client';

import { startTransition, useEffect, useRef, useState, type FormEvent } from 'react';
import type { FormField, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { checkForm, type ContentFormState } from './form-values';
import { FormFields, type UploadFileAction } from './FormFields';
import styles from './Content.module.css';
import { useSafeActionState } from '@/lib/safe-action';

interface ContentFormProps {
  locale: Locale;
  /** The API's field list (`Page.contact.fields`, `Form.fields`). */
  fields: readonly FormField[];
  action: (state: ContentFormState, data: FormData) => Promise<ContentFormState>;
  /** The button text: the API's (`Form.submitLabel`) or ours. */
  submitLabel: string;
  /** Extra hidden inputs the action needs (e.g. the form's slug). */
  hidden?: Record<string, string>;
  upload?: UploadFileAction;
  idPrefix: string;
  testId: string;
}

const NOTHING_YET: ContentFormState = {};

/**
 * A form drawn from a backend description and sent through a server action. Empty fields that must be
 * filled (`mustFill`) are refused before sending, all at once; the backend validates the rest and its
 * messages show next to the fields; its "thank you" replaces nothing (the form is emptied).
 */
export function ContentForm({ locale, fields, action, submitLabel, hidden = {}, upload, idPrefix, testId }: ContentFormProps) {
  const t = translator(locale);
  const [answered, dispatch, pending] = useSafeActionState(action, NOTHING_YET, locale);
  // what the checks made before sending found (null once the form was sent)
  const [checked, setChecked] = useState<ContentFormState | null>(null);
  const state = checked ?? answered;
  // Every accepted answer draws the fields afresh (uploads too); a refusal keeps them as they are.
  const [seen, setSeen] = useState(answered);
  const [sends, setSends] = useState(0);
  if (seen !== answered) {
    setSeen(answered);
    if (answered.ok) setSends((count) => count + 1);
  }
  const formRef = useRef<HTMLFormElement>(null);

  // After an answer (or a refused check), move focus to the message or the first refused field for keyboard and screen reader users.
  useEffect(() => {
    if (state === NOTHING_YET) return;
    if (state.ok) formRef.current?.reset();
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-form-message]')?.focus();
  }, [state]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const found = checkForm(fields, data, { required: t('contentFormRequired'), attach: t('contentFormAttach'), email: t('contentFormEmail'), empty: t('contentFormEmpty') });
    if (found.fieldErrors || found.message) {
      // what was typed stays: the inputs are uncontrolled and are not re-mounted
      setChecked({ ok: false, ...found });
      return;
    }
    setChecked(null);
    startTransition(() => dispatch(data));
  }

  const errors = state.fieldErrors ?? {};
  const showMessage = state.message && (state.ok || !Object.keys(errors).length);

  return (
    <form ref={formRef} className={styles.form} onSubmit={submit} aria-busy={pending || undefined} data-testid={testId} noValidate>
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {showMessage && (
        <p className={state.ok ? styles.success : styles.error} role={state.ok ? 'status' : 'alert'} tabIndex={-1} data-form-message="" data-testid={`${testId}-message`}>
          {state.message}
        </p>
      )}
      <FormFields key={`sent-${sends}`} locale={locale} fields={fields} errors={errors} values={state.ok ? {} : state.values} upload={upload} idPrefix={idPrefix} />
      <button type="submit" className={styles.primary} disabled={pending}>
        {pending ? t('contentSending') : submitLabel}
      </button>
    </form>
  );
}
