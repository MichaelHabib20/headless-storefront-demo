/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authSettingsFixture } from '@/test/auth-fixtures';
import { signUpAction } from './actions';
import { SignUpForm } from './SignUpForm';

vi.mock('./actions', () => ({ signUpAction: vi.fn() }));

const labels = { submit: 'Create account', submitting: 'Creating…', confirmPassword: 'Confirm password', optional: '(optional)', choose: 'Choose…', notEditable: 'Cannot be changed', showPassword: 'Show password' };
const input = (name: string) => document.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const type = (typed: Record<string, string>) => Object.entries(typed).forEach(([name, value]) => fireEvent.change(input(name), { target: { value } }));
const errorOf = (name: string) => document.getElementById(`field-${name}-error`)?.textContent;

beforeEach(() => vi.mocked(signUpAction).mockReset());

describe('SignUpForm', () => {
  it('shows every mistake it can see at once, before sending, and keeps what was typed', async () => {
    const settings = authSettingsFixture('en');
    render(<SignUpForm fields={settings.signup.fields} locale="en" labels={labels} phoneLength={settings.phone.length} />);
    type({ firstName: 'Mona', email: 'not-an-email', phone: '01', password: '12', passwordConfirmation: '13' });
    fireEvent.submit(screen.getByTestId('sign-up-form'));

    await waitFor(() => expect(errorOf('lastName')).toBe('This field is required.'));
    expect(errorOf('email')).toBe('Enter a valid e-mail address.');
    expect(errorOf('phone')).toBe('Enter a 11-digit phone number.');
    expect(errorOf('password')).toBe('Use at least 8 characters.');
    expect(errorOf('passwordConfirmation')).toBe('The passwords do not match.');
    expect(errorOf('firstName')).toBeUndefined();
    expect(signUpAction).not.toHaveBeenCalled();
    expect(input('email')).toHaveValue('not-an-email');
    expect(input('password')).toHaveValue('12');
  });

  it('sends a correct form and shows every message the API returned, keeping the fields', async () => {
    vi.mocked(signUpAction).mockResolvedValue({ fieldErrors: { phone: 'The phone has already been taken.', email: 'The email has already been taken.', referral: 'Unknown code.' } });
    const settings = authSettingsFixture('en');
    render(<SignUpForm fields={settings.signup.fields} locale="en" labels={labels} phoneLength={settings.phone.length} />);
    type({ firstName: 'Mona', lastName: 'Ali', email: 'mona@example.com', phone: '01000000009', password: 'Secret123', passwordConfirmation: 'Secret123' });
    fireEvent.submit(screen.getByTestId('sign-up-form'));

    await waitFor(() => expect(errorOf('phone')).toBe('The phone has already been taken.'));
    expect(errorOf('email')).toBe('The email has already been taken.');
    expect(screen.getAllByRole('alert').map((node) => node.textContent)).toContain('Unknown code.');
    expect(signUpAction).toHaveBeenCalledTimes(1);
    expect(input('password')).toHaveValue('Secret123');
    expect(input('phone')).toHaveValue('01000000009');
  });

  it('speaks Arabic', async () => {
    const settings = authSettingsFixture('ar');
    render(<SignUpForm fields={settings.signup.fields} locale="ar" labels={labels} phoneLength={settings.phone.length} />);
    fireEvent.submit(screen.getByTestId('sign-up-form'));
    await waitFor(() => expect(errorOf('firstName')).toBe('هذا الحقل مطلوب.'));
    expect(errorOf('passwordConfirmation')).toBe('هذا الحقل مطلوب.');
  });
});
