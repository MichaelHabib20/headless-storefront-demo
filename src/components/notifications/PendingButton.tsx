'use client';

import type { ButtonHTMLAttributes } from 'react';
import { useFormStatus } from 'react-dom';

/** Submit button that is disabled while its form's server action runs. */
export function PendingButton({ children, ...rest }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} {...rest}>
      {children}
    </button>
  );
}
