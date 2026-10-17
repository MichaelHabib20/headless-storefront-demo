/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { callAction, keptValues, sendFailedState, useSafeActionState } from './safe-action';

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.set(name, value);
  return data;
}

interface State {
  message?: string;
  values?: Record<string, string>;
  fieldErrors?: Record<string, string>;
}

function Form({ action, locale }: { action: (state: State, data: FormData) => Promise<State>; locale: 'en' | 'ar' }) {
  const [state, dispatch] = useSafeActionState<State>(action, {}, locale);
  return (
    <form action={dispatch}>
      {state.message && <p role="alert">{state.message}</p>}
      <input name="v.message" aria-label="Message" defaultValue={state.values?.message ?? ''} />
      <button type="submit">Send</button>
    </form>
  );
}

const failing = async (): Promise<never> => {
  throw new TypeError('Failed to fetch');
};

describe('safe server actions', () => {
  it('keeps what was typed, never passwords or Next fields; backend-form fields also under their own name', () => {
    expect(keptValues(form({ phone: '0100', password: 'x', newPassword: 'y', $ACTION_ID_1: '', 'v.message': 'Hi' }))).toEqual({ phone: '0100', 'v.message': 'Hi', message: 'Hi' });
  });

  it('a failed request keeps the previous state but not its field errors, with the message in both languages', () => {
    expect(sendFailedState('en', form({ name: 'Mona' }), { sent: true, fieldErrors: { name: 'x' } })).toEqual({
      sent: true,
      ok: false,
      fieldErrors: {},
      message: 'We could not send this. Check your connection and try again.',
      values: { name: 'Mona' },
    });
    expect(sendFailedState('ar', form({}), {})).toMatchObject({ message: 'تعذر الإرسال. تحقق من اتصالك وحاول مرة أخرى.' });
  });

  it('a request that fails shows a message instead of crashing the page, and the typed text stays', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Form action={vi.fn(failing)} locale="ar" />);
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'مرحبا' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Send' })));
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذر الإرسال. تحقق من اتصالك وحاول مرة أخرى.');
    expect(screen.getByLabelText('Message')).toHaveValue('مرحبا');
    log.mockRestore();
  });

  it('callAction: a failed request answers the fallback; redirects still go through', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(callAction(failing, { ok: false })).resolves.toEqual({ ok: false });
    await expect(callAction(async () => ({ ok: true }), { ok: false })).resolves.toEqual({ ok: true });
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/en/account;307;' });
    await expect(
      callAction(async () => {
        throw redirect;
      }, { ok: false }),
    ).rejects.toBe(redirect);
    log.mockRestore();
  });
});
