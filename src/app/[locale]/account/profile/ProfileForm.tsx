'use client';

import type { Locale, ProfileField } from '@/sdk';
import { AuthFields } from '@/components/auth/AuthFields';
import type { FormState } from '@/lib/form';
import { updateProfileAction } from './actions';
import { useSafeActionState } from '@/lib/safe-action';

interface ProfileFormProps {
  /** `Profile.fields`: the form with the current values and what may be changed. */
  fields: ProfileField[];
  locale: Locale;
  labels: { save: string; saving: string; optional: string; choose: string; notEditable: string };
}

export function ProfileForm({ fields, locale, labels }: ProfileFormProps) {
  const [state, action, pending] = useSafeActionState<FormState>(updateProfileAction, {}, locale);

  return (
    <form action={action} noValidate data-testid="profile-form">
      <input type="hidden" name="locale" value={locale} />
      {state.message && (
        <div className={state.fieldErrors && Object.keys(state.fieldErrors).length ? 'alert' : 'success'} role="status" data-testid="profile-status">
          {state.message}
        </div>
      )}
      <AuthFields fields={fields} values={state.values} errors={state.fieldErrors} labels={labels} />
      <button type="submit" disabled={pending}>
        {pending ? labels.saving : labels.save}
      </button>
    </form>
  );
}
