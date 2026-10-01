'use client';

import { useState } from 'react';
import type { FormField, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { inputAttributes, inputName } from './form-values';
import styles from './Content.module.css';

/** Uploads one file (POST /uploads through a server action) and answers its id. */
export type UploadFileAction = (locale: Locale, form: FormData) => Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }>;

interface FormFieldsProps {
  locale: Locale;
  /** The API's description: label, kind, required, options — nothing is added or reordered here. */
  fields: readonly FormField[];
  /** The API's first message per field name. */
  errors?: Record<string, string>;
  /** What the shopper typed before a refused submit. */
  values?: Record<string, string | string[]>;
  /** Needed when a field is a file. */
  upload?: UploadFileAction;
  /** Prefix of the element ids (two forms on one page must not share ids). */
  idPrefix: string;
}

/**
 * Inputs drawn from a backend form description (`FormField[]`): text, email, phone, password,
 * date, textarea, select (single / multiple), file and checkbox. Unknown kinds are text inputs.
 * Values are sent back under `v.<name>`; the backend validates them and its messages show here.
 */
export function FormFields({ locale, fields, errors = {}, values = {}, upload, idPrefix }: FormFieldsProps) {
  return (
    <div className={styles.fields}>
      {fields.map((field) => (
        <Field key={field.name} locale={locale} field={field} error={errors[field.name]} value={values[field.name]} upload={upload} id={`${idPrefix}-${field.name}`} />
      ))}
    </div>
  );
}

interface FieldProps {
  locale: Locale;
  field: FormField;
  error: string | undefined;
  value: string | string[] | undefined;
  upload?: UploadFileAction;
  id: string;
}

function Field({ locale, field, error, value, upload, id }: FieldProps) {
  const t = translator(locale);
  const describedBy = [field.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: inputName(field),
    required: field.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  } as const;
  const text = typeof value === 'string' ? value : '';

  let control;
  if (field.kind === 'textarea') {
    control = <textarea {...common} className={styles.textarea} rows={5} maxLength={field.maxLength ?? undefined} placeholder={field.placeholder ?? undefined} defaultValue={text} />;
  } else if (field.kind === 'select') {
    const chosen = Array.isArray(value) ? value : value ? [value] : field.options.filter((option) => option.selected).map((option) => option.value);
    control = (
      <select {...common} className={styles.select} multiple={field.multiple} defaultValue={field.multiple ? chosen : (chosen[0] ?? '')}>
        {!field.multiple && <option value="">{field.placeholder ?? t('contentFormChoose')}</option>}
        {field.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  } else if (field.kind === 'checkbox') {
    return (
      <div className={styles.field}>
        <label className={styles.checkbox} htmlFor={id}>
          <input {...common} type="checkbox" value="true" defaultChecked={text === 'true'} />
          {field.label}
        </label>
        <FieldNotes id={id} hint={field.hint} error={error} />
      </div>
    );
  } else if (field.kind === 'file') {
    control = field.multiple ? (
      <FilesInput locale={locale} field={field} upload={upload} id={id} required={field.required} describedBy={describedBy} invalid={Boolean(error)} />
    ) : (
      <FileInput locale={locale} field={field} upload={upload} id={id} required={field.required} describedBy={describedBy} invalid={Boolean(error)} />
    );
  } else {
    control = (
      <input
        {...common}
        {...inputAttributes(field.kind)}
        className={styles.input}
        maxLength={field.maxLength ?? undefined}
        placeholder={field.placeholder ?? undefined}
        defaultValue={field.kind === 'password' ? undefined : text}
      />
    );
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {field.label}
        {!field.required && <span className={styles.optional}> {t('contentOptional')}</span>}
      </label>
      {control}
      <FieldNotes id={id} hint={field.hint} error={error} />
    </div>
  );
}

function FieldNotes({ id, hint, error }: { id: string; hint?: string | null; error?: string }) {
  return (
    <>
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.fieldError} data-testid="field-error">
          {error}
        </p>
      )}
    </>
  );
}

interface FileInputProps {
  locale: Locale;
  field: FormField;
  upload?: UploadFileAction;
  id: string;
  required: boolean;
  describedBy?: string;
  invalid: boolean;
}

/** Uploads the chosen file right away; the form then sends the file's id, never the file or a URL. */
function FileInput({ locale, field, upload, id, required, describedBy, invalid }: FileInputProps) {
  const t = translator(locale);
  const [state, setState] = useState<{ status: 'idle' | 'uploading' | 'done' | 'failed'; id?: string; name?: string; message?: string }>({ status: 'idle' });

  async function choose(file: File | undefined) {
    if (!file || !upload) return;
    setState({ status: 'uploading' });
    const form = new FormData();
    form.set('file', file);
    const result = await upload(locale, form).catch(() => ({ ok: false as const, message: t('contentFormUploadFailed') }));
    setState(result.ok ? { status: 'done', id: result.id, name: result.name } : { status: 'failed', message: result.message });
  }

  return (
    <div className={styles.file}>
      <input
        id={id}
        type="file"
        className={styles.fileInput}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required={required && state.status !== 'done'}
        aria-invalid={invalid || state.status === 'failed' ? true : undefined}
        aria-describedby={describedBy}
        disabled={!upload || state.status === 'uploading'}
        onChange={(event) => choose(event.currentTarget.files?.[0])}
        data-testid={`file-${field.name}`}
      />
      {/* the id the API issued for the uploaded file */}
      <input type="hidden" name={inputName(field)} value={state.status === 'done' ? (state.id ?? '') : ''} />
      <p className={state.status === 'failed' ? styles.fieldError : styles.hint} role="status">
        {state.status === 'uploading' && t('contentFormUploading')}
        {state.status === 'done' && t('contentFormUploaded').replace('{name}', state.name ?? '')}
        {state.status === 'failed' && state.message}
      </p>
    </div>
  );
}

/**
 * A file field with `multiple`: each chosen file is uploaded right away and listed with a remove
 * button; the form sends one id per uploaded file under the field's name. How many are allowed is
 * the backend's rule (its 422 message shows under the field).
 */
function FilesInput({ locale, field, upload, id, required, describedBy, invalid }: FileInputProps) {
  const t = translator(locale);
  const [files, setFiles] = useState<{ id: string; name: string }[]>([]);
  const [status, setStatus] = useState<{ uploading: boolean; message?: string }>({ uploading: false });

  async function choose(list: FileList | null) {
    if (!list?.length || !upload) return;
    setStatus({ uploading: true });
    let message: string | undefined;
    for (const file of Array.from(list)) {
      const form = new FormData();
      form.set('file', file);
      const result = await upload(locale, form).catch(() => ({ ok: false as const, message: t('contentFormUploadFailed') }));
      if (result.ok) setFiles((current) => [...current, { id: result.id, name: result.name }]);
      else message = result.message;
    }
    setStatus({ uploading: false, message });
  }

  return (
    <div className={styles.file}>
      <input
        id={id}
        type="file" multiple
        className={styles.fileInput}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required={required && files.length === 0}
        aria-invalid={invalid || status.message ? true : undefined}
        aria-describedby={describedBy}
        disabled={!upload || status.uploading}
        onChange={(event) => {
          void choose(event.currentTarget.files);
          event.currentTarget.value = '';
        }}
        data-testid={`file-${field.name}`}
      />
      {files.length > 0 && (
        <ul className={styles.fileList} data-testid={`files-${field.name}`}>
          {files.map((file) => (
            <li key={file.id}>
              {/* the id the API issued for the uploaded file */}
              <input type="hidden" name={inputName(field)} value={file.id} />
              <span>{file.name}</span>
              <button type="button" className={styles.fileRemove} onClick={() => setFiles((current) => current.filter((entry) => entry.id !== file.id))}>
                {t('contentFormRemoveFile').replace('{name}', file.name)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={status.message ? styles.fieldError : styles.hint} role="status">
        {status.uploading && t('contentFormUploading')}
        {!status.uploading && status.message}
      </p>
    </div>
  );
}
