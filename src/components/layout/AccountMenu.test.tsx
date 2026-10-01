/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Me } from '@/sdk';
import { anonymousMeFixture, meFixture } from '@/test/fixtures';
import { AccountMenu } from './AccountMenu';

vi.mock('@/lib/auth.actions', () => ({ signOutAction: Object.assign(vi.fn(), { bind: () => vi.fn() }) }));

const features = { signup: true, notifications: true };

describe('AccountMenu', () => {
  it('shows the customer name from Me and the account links with sign-out', () => {
    const me: Me = { ...meFixture('en'), customer: { firstName: 'Mona', lastName: 'Ali', phoneVerified: true, approval: null } };
    render(<AccountMenu locale="en" me={me} features={features} />);

    expect(screen.getByTestId('account-menu-name')).toHaveTextContent('Mona Ali');
    expect(screen.getByRole('link', { name: 'My profile' })).toHaveAttribute('href', '/en/account/profile');
    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '/en/account/orders');
    expect(screen.getByRole('link', { name: 'My addresses' })).toHaveAttribute('href', '/en/account/addresses');
    expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/en/notifications');
    expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/en/account/password');
    expect(screen.getByTestId('sign-out')).toHaveTextContent('Sign out');
    expect(screen.queryByTestId('menu-sign-in')).toBeNull();
  });

  it('offers sign-in and create-account to visitors and guests, the latter only when sign-ups are on', () => {
    const { rerender } = render(<AccountMenu locale="ar" me={anonymousMeFixture()} features={features} />);
    expect(screen.getByTestId('menu-sign-in')).toHaveAttribute('href', '/ar/sign-in');
    expect(screen.getByTestId('menu-sign-up')).toHaveTextContent('إنشاء حساب');
    expect(screen.queryByTestId('sign-out')).toBeNull();

    const guest: Me = { ...meFixture('en'), isGuest: true, customer: null };
    rerender(<AccountMenu locale="en" me={guest} features={{ signup: false, notifications: false }} />);
    expect(screen.getByTestId('menu-sign-in')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-sign-up')).toBeNull();

    rerender(<AccountMenu locale="en" me={null} features={features} />);
    expect(screen.getByTestId('menu-sign-in')).toBeInTheDocument();
  });

  it('hides the notifications link when the store has them off', () => {
    render(<AccountMenu locale="en" me={meFixture('en')} features={{ signup: true, notifications: false }} />);
    expect(screen.queryByRole('link', { name: 'Notifications' })).toBeNull();
  });
});
