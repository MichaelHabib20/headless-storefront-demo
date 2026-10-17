'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import type { FormField, Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { fieldShown, inputAttributes, inputName, mustFill, VALUE_PREFIX, watchedValues } from './form-values';
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

const NO_ERRORS: Record<string, string> = {};

/**
 * Inputs drawn from a backend form description (`FormField[]`): text, email, phone, password,
 * date, textarea, select (single / multiple), file and checkbox. Unknown kinds are text inputs.
 * Values are sent back under `v.<name>`; the backend validates them and its messages show here.
 * A field's message goes away once the shopper changes that field (types, picks, attaches a file),
 * until the next answer brings new messages.
 */
export function FormFields({ locale, fields, errors = NO_ERRORS, values = {}, upload, idPrefix }: FormFieldsProps) {
  // phase B: fields with `showWhen` follow the current value of the fields they name
  const [current, setCurrent] = useState(() => watchedValues(fields, values));
  const watched = Object.keys(current);
  // the fields changed since these messages came (a new `errors` object starts over)
  const [edited, setEdited] = useState<{ errors: Record<string, string>; names: readonly string[] }>({ errors, names: [] });
  const editedNames = edited.errors === errors ? edited.names : [];

  function changed(event: ChangeEvent<HTMLDivElement>) {
    const target = event.target as unknown as { name?: string; value?: string; dataset?: DOMStringMap };
    const name = typeof target.name === 'string' && target.name.startsWith(VALUE_PREFIX) ? target.name.slice(VALUE_PREFIX.length) : (target.dataset?.field ?? null);
    if (name && watched.includes(name)) setCurrent((before) => ({ ...before, [name]: String(target.value ?? '') }));
    if (name && errors[name] && !editedNames.includes(name)) setEdited({ errors, names: [...editedNames, name] });
  }

  const shown = fields.filter((field) => fieldShown(field, current));
  return (
    <div className={styles.fields} onChange={changed}>
      {shown.map((field) => (
        <Field key={field.name} locale={locale} field={field} toFill={mustFill(field, shown)} error={editedNames.includes(field.name) ? undefined : errors[field.name]} value={values[field.name]} upload={upload} id={`${idPrefix}-${field.name}`} />
      ))}
    </div>
  );
}

interface FieldProps {
  locale: Locale;
  field: FormField;
  /** `mustFill()`: the backend's `required`, or the only field of the form. */
  toFill: boolean;
  error: string | undefined;
  value: string | string[] | undefined;
  upload?: UploadFileAction;
  id: string;
}

function Field({ locale, field, toFill, error, value, upload, id }: FieldProps) {
  const t = translator(locale);
  const describedBy = [field.hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    name: inputName(field),
    required: toFill,
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
      <FilesInput locale={locale} field={field} upload={upload} id={id} required={toFill} describedBy={describedBy} invalid={Boolean(error)} />
    ) : (
      <FileInput locale={locale} field={field} upload={upload} id={id} required={toFill} describedBy={describedBy} invalid={Boolean(error)} />
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
      {/* a field to fill gets the old storefront's "*" (drawn by CSS, not read out: the input is `required`) */}
      <label htmlFor={id} className={toFill ? `${styles.label} ${styles.requiredLabel}` : styles.label}>
        {field.label}
        {!toFill && <span className={styles.optional}> {t('contentOptional')}</span>}
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

/** A picture of the chosen file for the tile: the image itself (a local `blob:` URL), or nothing for a PDF. */
function usePreview(): [string | null, (file: File | null) => void] {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const show = (file: File | null) => setPreview(file && file.type.startsWith('image/') && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null);
  return [preview, show];
}

/**
 * The picker tile (like the old storefront's image uploader): a square that opens the file chooser
 * and shows the chosen picture. The real control is the file input before it (visually hidden,
 * keyboard-focusable); the tile is only its larger click target, so it is hidden from screen readers.
 */
function PickerTile({ inputId, title, preview, fileName, busy, invalid }: { inputId: string; title: string; preview: string | null; fileName: string | null; busy: boolean; invalid: boolean }) {
  const classes = [styles.tile, invalid ? styles.tileInvalid : '', busy ? styles.tileBusy : ''].filter(Boolean).join(' ');
  return (
    <label htmlFor={inputId} className={classes} title={title} aria-hidden="true" data-testid="file-tile">
      {preview ? (
        <span className={styles.tilePreview} style={{ backgroundImage: `url("${preview}")` }} data-testid="file-preview" />
      ) : fileName ? (
        <span className={styles.tileName}>{fileName}</span>
      ) : (
        <svg className={styles.tileIcon} viewBox="0 0 24 24" width="40" height="40" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm1 2v9.6l3.3-3.3a1 1 0 0 1 1.4 0l2.8 2.8 1.8-1.8a1 1 0 0 1 1.4 0L19 16.6V6H5Zm10 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
        </svg>
      )}
    </label>
  );
}

/** Uploads the chosen file right away; the form then sends the file's id, never the file or a URL. */
function FileInput({ locale, field, upload, id, required, describedBy, invalid }: FileInputProps) {
  const t = translator(locale);
  const [state, setState] = useState<{ status: 'idle' | 'uploading' | 'done' | 'failed'; id?: string; name?: string; message?: string }>({ status: 'idle' });
  const [preview, showPreview] = usePreview();

  async function choose(file: File | undefined) {
    if (!file || !upload) return;
    setState({ status: 'uploading' });
    showPreview(file);
    const form = new FormData();
    form.set('file', file);
    const result = await upload(locale, form).catch(() => ({ ok: false as const, message: t('contentFormUploadFailed') }));
    setState(result.ok ? { status: 'done', id: result.id, name: result.name } : { status: 'failed', message: result.message });
    if (!result.ok) showPreview(null);
  }

  function remove() {
    setState({ status: 'idle' });
    showPreview(null);
  }

  return (
    <div className={styles.file}>
      <input
        id={id}
        type="file"
        className={`${styles.fileInput} visually-hidden`}
        accept="image/jpeg,image/png,image/webp,application/pdf"
        required={required && state.status !== 'done'}
        aria-invalid={invalid || state.status === 'failed' ? true : undefined}
        aria-describedby={describedBy}
        disabled={!upload || state.status === 'uploading'}
        onChange={(event) => {
          void choose(event.currentTarget.files?.[0]);
          event.currentTarget.value = '';
        }}
        data-testid={`file-${field.name}`}
        data-field={field.name}
      />
      <PickerTile
        inputId={id}
        title={state.status === 'done' ? t('contentFormChangeFile') : t('contentFormPickFile')}
        preview={preview}
        fileName={state.status === 'done' ? (state.name ?? null) : null}
        busy={state.status === 'uploading'}
        invalid={invalid || state.status === 'failed'}
      />
      {/* the id the API issued for the uploaded file */}
      <input type="hidden" name={inputName(field)} value={state.status === 'done' ? (state.id ?? '') : ''} />
      <p className={state.status === 'failed' ? styles.fieldError : styles.hint} role="status">
        {state.status === 'uploading' && t('contentFormUploading')}
        {state.status === 'done' && t('contentFormUploaded').replace('{name}', state.name ?? '')}
        {state.status === 'failed' && state.message}
      </p>
      {state.status === 'done' && (
        <button type="button" className={styles.fileRemove} onClick={remove}>
          {t('contentFormRemoveFile').replace('{name}', state.name ?? '')}
        </button>
      )}
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
        className={`${styles.fileInput} visually-hidden`}
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
        data-field={field.name}
      />
      <PickerTile inputId={id} title={t('contentFormPickFile')} preview={null} fileName={null} busy={status.uploading} invalid={invalid || Boolean(status.message)} />
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
