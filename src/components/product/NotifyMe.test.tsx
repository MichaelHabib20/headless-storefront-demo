/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { NotifyMe, type NotifyMeAction } from './NotifyMe';

const labels = { button: 'Notify me when available', email: 'Email address', failed: 'We could not save your request. Please try again.' };

// A fresh mock per test (a mock reset in beforeEach made vitest report the rejection the component handles).
let action: Mock<NotifyMeAction>;
beforeEach(() => {
  action = vi.fn<NotifyMeAction>();
});

function renderNotify(locale: 'en' | 'ar' = 'en') {
  render(<NotifyMe productId={14400} locale={locale} action={action} labels={labels} />);
}

describe('NotifyMe', () => {
  it('asks in one click and shows the confirmation', async () => {
    action.mockResolvedValue({ ok: true, message: "We'll let you know when it's back." });
    renderNotify();

    expect(screen.queryByLabelText('Email address')).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Notify me when available' }));

    expect(action).toHaveBeenCalledWith('en', 14400, null);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("We'll let you know when it's back."));
    expect(screen.queryByRole('button', { name: 'Notify me when available' })).toBeNull();
  });

  it('shows the email field only when the backend asks for one, then sends what was typed', async () => {
    action.mockResolvedValueOnce({ ok: false, message: 'Please check the highlighted fields.', emailError: 'Enter your email so we can tell you when it is back.' });
    action.mockResolvedValueOnce({ ok: true, message: "We'll let you know when it's back." });
    renderNotify();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Notify me when available' }));
    const email = await screen.findByLabelText('Email address');
    await waitFor(() => expect(email).toHaveFocus());
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Enter your email so we can tell you when it is back.');

    await user.type(email, '  sara@example.com ');
    await user.click(screen.getByRole('button', { name: 'Notify me when available' }));
    expect(action).toHaveBeenLastCalledWith('en', 14400, 'sara@example.com');
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent("We'll let you know when it's back."));
  });

  it('shows the backend message when the product is already back in stock', async () => {
    action.mockResolvedValue({ ok: false, message: 'Good news: this product is back in stock.' });
    renderNotify();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Notify me when available' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Good news: this product is back in stock.'));
    expect(screen.queryByLabelText('Email address')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notify me when available' })).toBeEnabled();
  });

  it('shows its own message when the action cannot run', async () => {
    action.mockImplementation(async () => {
      throw new Error('offline');
    });
    renderNotify('ar');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Notify me when available' }));
    expect(action).toHaveBeenCalledWith('ar', 14400, null);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(labels.failed));
  });
});
