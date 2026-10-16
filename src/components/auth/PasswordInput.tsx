'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { Icon } from '@/components/ui/Icon';

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  /** The toggle's name for screen readers ("Show password"); its state is `aria-pressed`. */
  toggleLabel: string;
}

/**
 * A password input with a show / hide toggle (the old storefront's eye icon). The toggle is a real
 * button: `aria-pressed` says whether the password is shown, `aria-controls` points at the input,
 * and it never submits the form. The input keeps every attribute it is given.
 */
export function PasswordInput({ toggleLabel, id, className, ...input }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const ownId = useId();
  const inputId = id ?? `password-${ownId}`;

  return (
    <span className={['password-input', className].filter(Boolean).join(' ')}>
      <input {...input} id={inputId} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={toggleLabel}
        aria-pressed={visible}
        aria-controls={inputId}
        disabled={input.disabled}
        onClick={() => setVisible((shown) => !shown)}
        data-testid="password-toggle"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={20} />
      </button>
    </span>
  );
}
