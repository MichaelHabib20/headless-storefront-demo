/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextStepGate } from './NextStepGate';

const pathname = vi.hoisted(() => ({ current: '/en' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const hrefs = { verifyPhone: '/en/verify-phone', completeProfile: '/en/account/complete-profile', waitingApproval: '/en/session/waiting-approval' };
const labels = { verifyBanner: 'Not verified yet.', verifyLink: 'Verify it now', dismiss: 'Dismiss', completeBanner: 'Complete it.', completeLink: 'Complete your profile', waitingTitle: 'Being reviewed', waitingText: 'Wait.', waitingLink: 'More' };

beforeEach(() => {
  pathname.current = '/en';
  window.sessionStorage.clear();
});

describe('NextStepGate', () => {
  it('shows the shop when nothing is pending', () => {
    render(
      <NextStepGate next={null} hrefs={hrefs} labels={labels}>
        <p>shop</p>
      </NextStepGate>,
    );
    expect(screen.getByText('shop')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('replaces the shop with the waiting notice, except on the auth pages', () => {
    const { rerender } = render(
      <NextStepGate next="waiting_approval" hrefs={hrefs} labels={labels}>
        <p>shop</p>
      </NextStepGate>,
    );
    expect(screen.queryByText('shop')).toBeNull();
    expect(screen.getByTestId('approval-gate')).toHaveTextContent('Being reviewed');
    expect(screen.getByRole('link', { name: 'More' })).toHaveAttribute('href', '/en/session/waiting-approval');

    pathname.current = '/en/session/waiting-approval';
    rerender(
      <NextStepGate next="waiting_approval" hrefs={hrefs} labels={labels}>
        <p>waiting page</p>
      </NextStepGate>,
    );
    expect(screen.getByText('waiting page')).toBeInTheDocument();
  });

  it('shows a dismissible banner for the phone verification', () => {
    render(
      <NextStepGate next="verify_phone" hrefs={hrefs} labels={labels}>
        <p>shop</p>
      </NextStepGate>,
    );
    expect(screen.getByText('shop')).toBeInTheDocument();
    expect(screen.getByTestId('verify-phone-banner')).toHaveTextContent('Not verified yet.');
    expect(screen.getByRole('link', { name: 'Verify it now' })).toHaveAttribute('href', '/en/verify-phone');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('verify-phone-banner')).toBeNull();
    expect(window.sessionStorage.getItem('sc_verify_phone_dismissed')).toBe('1');
  });

  it('keeps the complete-profile banner until the profile is complete', () => {
    render(
      <NextStepGate next="complete_profile" hrefs={hrefs} labels={labels}>
        <p>shop</p>
      </NextStepGate>,
    );
    expect(screen.getByTestId('complete-profile-banner')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Complete your profile' })).toHaveAttribute('href', '/en/account/complete-profile');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
