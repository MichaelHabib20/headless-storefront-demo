/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { authSettingsFixture, fullAuthSettingsFixture, profileFixture } from '@/test/auth-fixtures';
import { AuthFields } from './AuthFields';

const labels = { optional: '(optional)', choose: 'Choose…', notEditable: 'Cannot be changed' };

describe('AuthFields', () => {
  it('draws every sign-up field the API lists, in its order, with its label, kind and required flag', () => {
    const fields = authSettingsFixture('en').signup.fields;
    render(
      <form>
        <AuthFields fields={fields} labels={labels} />
      </form>,
    );

    const inputs = [...document.querySelectorAll<HTMLInputElement>('input')];
    expect(inputs.map((input) => input.name)).toEqual(fields.map((field) => field.name));
    expect(inputs.map((input) => input.type)).toEqual(['text', 'text', 'tel', 'email', 'password', 'date']);
    expect(inputs.map((input) => input.required)).toEqual(fields.map((field) => field.required));
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute('maxlength', '11');
    expect(screen.getByLabelText(/Phone number/)).toHaveAccessibleDescription('11 digits');
    expect(screen.getByLabelText(/Email/)).not.toBeRequired();
    expect(screen.getAllByText('(optional)', { exact: false })).toHaveLength(2); // e-mail and birthdate
  });

  it('draws selects from the options and Arabic labels as they come', () => {
    const fields = fullAuthSettingsFixture('ar').signup.fields;
    render(<AuthFields fields={fields} labels={{ optional: '(اختياري)', choose: 'اختر…', notEditable: 'x' }} />);
    const select = document.querySelector<HTMLSelectElement>('select[name="customerGroup"]')!;
    expect(select).toBeRequired();
    expect([...select.options].map((option) => option.textContent)).toEqual(['اختر…', 'صيدليات', 'عيادات']);
    expect(screen.getByLabelText(/كود الإحالة/)).toHaveAttribute('name', 'referralCode');
  });

  it('shows the current values, marks the identifier read-only and does not submit it', () => {
    const { fields } = profileFixture('en');
    render(<AuthFields fields={fields} labels={labels} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue('Test');
    const phone = screen.getByLabelText(/Phone number/);
    expect(phone).toHaveValue('01222353123');
    expect(phone).toBeDisabled();
    expect(screen.getByText('(Cannot be changed)', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText(/Date of birth/)).toHaveValue('1990-05-04');
  });

  it('keeps what the shopper typed and shows the API message under the field', () => {
    const fields = authSettingsFixture('en').signup.fields;
    render(<AuthFields fields={fields} values={{ firstName: 'Sara' }} errors={{ phone: 'Enter a mobile number of 11 digits.' }} labels={labels} />);
    expect(screen.getByLabelText(/First name/)).toHaveValue('Sara');
    expect(screen.getByLabelText(/Phone number/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/Phone number/)).toHaveAccessibleDescription(/Enter a mobile number of 11 digits\./);
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a mobile number of 11 digits.');
  });

  it('draws what `after` gives right after that field', () => {
    const fields = authSettingsFixture('en').signup.fields;
    render(<AuthFields fields={fields} labels={labels} after={(field) => (field.kind === 'password' ? <input name="passwordConfirmation" type="password" /> : null)} />);
    const names = [...document.querySelectorAll<HTMLInputElement>('input')].map((input) => input.name);
    expect(names.indexOf('passwordConfirmation')).toBe(names.indexOf('password') + 1);
  });
});
