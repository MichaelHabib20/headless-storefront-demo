/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { translator } from '@/lib/i18n';
import { authSettingsFixture } from '@/test/auth-fixtures';
import { AuthFields } from './AuthFields';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it.each(['en', 'ar'] as const)('shows and hides the password with an accessible toggle (%s)', async (locale) => {
    const t = translator(locale);
    const user = userEvent.setup();
    render(
      <label>
        {t('authPassword')}
        <PasswordInput name="password" autoComplete="current-password" required aria-invalid={false} toggleLabel={t('authShowPassword')} />
      </label>,
    );

    const input = screen.getByLabelText(t('authPassword'));
    const toggle = screen.getByRole('button', { name: t('authShowPassword') });
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('name', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    expect(input).toBeRequired();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-controls', input.id);
    expect(toggle).toHaveAttribute('type', 'button');

    await user.type(input, 'secret123');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveValue('secret123');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });

  it('the toggle never submits the form; the keyboard works', async () => {
    const submit = vi.fn((event: Event) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={(event) => submit(event.nativeEvent)}>
        <PasswordInput name="password" toggleLabel="Show password" />
      </form>,
    );
    const toggle = screen.getByRole('button', { name: 'Show password' });
    toggle.focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(submit).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  it('the Arabic labels are Arabic', () => {
    expect(translator('ar')('authShowPassword')).toBe('إظهار كلمة المرور');
    expect(translator('en')('authShowPassword')).toBe('Show password');
  });
});

describe('AuthFields: password fields', () => {
  const labels = { optional: '(optional)', choose: 'Choose', notEditable: 'Cannot be changed' };

  it('gets the show / hide toggle when a toggle name is given', async () => {
    const user = userEvent.setup();
    render(<AuthFields fields={authSettingsFixture('en').signup.fields} labels={{ ...labels, showPassword: 'Show password' }} />);
    const password = document.querySelector<HTMLInputElement>('input[name="password"]')!;
    expect(password.type).toBe('password');
    expect(password).toBeRequired();
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    expect(password.id).toBe('field-password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password.type).toBe('text');
  });

  it('has no toggle without one (the profile)', () => {
    render(<AuthFields fields={authSettingsFixture('en').signup.fields} labels={labels} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
