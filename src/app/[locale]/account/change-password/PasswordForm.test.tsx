/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { changePasswordAction } from './actions';
import { PasswordForm } from './PasswordForm';

vi.mock('./actions', () => ({ changePasswordAction: vi.fn() }));

const labels = {
  en: { current: 'Current password', next: 'New password', hint: 'At least 8 characters', confirm: 'Confirm new password', submit: 'Change password', submitting: 'Saving…', showPassword: 'Show password' },
  ar: { current: 'كلمة المرور الحالية', next: 'كلمة المرور الجديدة', hint: '8 أحرف على الأقل', confirm: 'تأكيد كلمة المرور الجديدة', submit: 'تغيير كلمة المرور', submitting: 'جارٍ الحفظ…', showPassword: 'إظهار كلمة المرور' },
};

const NAMES = ['currentPassword', 'newPassword', 'passwordConfirmation'];
const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;

function fill(...typed: [string, string, string]) {
  NAMES.forEach((name, index) => fireEvent.change(input(name), { target: { value: typed[index] } }));
}

const values = () => NAMES.map((name) => input(name).value);

beforeEach(() => vi.mocked(changePasswordAction).mockReset());

describe('PasswordForm', () => {
  it('shows every simple mistake at once, sends nothing and keeps what was typed', async () => {
    render(<PasswordForm locale="en" labels={labels.en} />);
    fill('', 'short', 'other');
    fireEvent.submit(screen.getByTestId('password-form'));

    await waitFor(() => expect(screen.getAllByTestId('field-error')).toHaveLength(3));
    expect(screen.getAllByTestId('field-error').map((node) => node.textContent)).toEqual(['This field is required.', 'Use at least 8 characters.', 'The passwords do not match.']);
    expect(changePasswordAction).not.toHaveBeenCalled();
    expect(values()).toEqual(['', 'short', 'other']);
  });

  it('keeps the three fields after the API refused, and shows each of its messages', async () => {
    vi.mocked(changePasswordAction).mockResolvedValue({ message: 'The current password is not correct.', fieldErrors: { newPassword: 'Too common.', password: 'Pick another one.' } });
    render(<PasswordForm locale="en" labels={labels.en} />);
    fill('wrong-one', 'NewPass1234', 'NewPass1234');
    fireEvent.submit(screen.getByTestId('password-form'));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('The current password is not correct. Pick another one.'));
    expect(screen.getByTestId('field-error')).toHaveTextContent('Too common.');
    expect(values()).toEqual(['wrong-one', 'NewPass1234', 'NewPass1234']);
  });

  it('empties the fields once the password was changed', async () => {
    vi.mocked(changePasswordAction).mockResolvedValue({ done: 'Your password was changed.' });
    render(<PasswordForm locale="en" labels={labels.en} />);
    fill('OldPass123', 'NewPass1234', 'NewPass1234');
    fireEvent.submit(screen.getByTestId('password-form'));
    await waitFor(() => expect(screen.getByTestId('password-changed')).toHaveTextContent('Your password was changed.'));
    expect(values()).toEqual(['', '', '']);
  });

  it('speaks Arabic', async () => {
    render(<PasswordForm locale="ar" labels={labels.ar} />);
    fill('x', 'NewPass1234', 'Different1234');
    fireEvent.submit(screen.getByTestId('password-form'));
    await waitFor(() => expect(screen.getByTestId('field-error')).toHaveTextContent('كلمتا المرور غير متطابقتين.'));
    expect(values()).toEqual(['x', 'NewPass1234', 'Different1234']);
  });
});
