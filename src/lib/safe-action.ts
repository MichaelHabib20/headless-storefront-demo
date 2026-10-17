import { useActionState } from 'react';
import type { Locale } from '@/sdk';
import { VALUE_PREFIX } from '@/components/content/form-values';
import { translator } from './i18n';

/**
 * What the browser typed into a form, to show again after a failed send: every text field except
 * passwords and Next's own fields (`$ACTION_...`). Files can't be put back in an input. The fields of
 * a backend-described form (inputs named `v.<field>`) are kept under the field's name too.
 */
export function keptValues(data: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of data.entries()) {
    if (typeof value !== 'string' || name.startsWith('$') || /password/i.test(name)) continue;
    values[name] = value;
    if (name.startsWith(VALUE_PREFIX)) values[name.slice(VALUE_PREFIX.length)] = value;
  }
  return values;
}

/**
 * Next's own control flow thrown through an action call (redirect(), notFound(), ...): an error whose
 * `digest` starts with NEXT_ (what Next's isNextRouterError checks). It must reach Next's boundaries.
 */
function rethrowNextSignal(error: unknown): void {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw error;
}

/**
 * The state a form shows when its server action could not even be reached (the shopper's network
 * dropped, the server answered with an error page instead of the action's answer): the previous
 * state (e.g. "the code was sent"), no field errors, the message in the page's language, and what
 * was typed. API failures are answered by the server actions themselves; this is only the request.
 */
export function sendFailedState<S extends object>(locale: Locale, data: FormData, previous: S): S {
  return { ...previous, ok: false, message: translator(locale)('formSendFailed'), fieldErrors: {}, values: keptValues(data) };
}

/**
 * `useActionState` for a form whose action is a server action: a request that fails becomes
 * sendFailedState instead of an error that replaces the whole page ("Application error") and loses
 * what was typed. Next's own signals (the redirect after signing in, notFound) still go through.
 */
export function useSafeActionState<S extends object>(action: (state: Awaited<S>, data: FormData) => S | Promise<S>, initial: Awaited<S>, locale: Locale) {
  const run = async (previous: Awaited<S>, data: FormData): Promise<S> => {
    try {
      return await action(previous, data);
    } catch (error) {
      rethrowNextSignal(error);
      console.error('form request failed', error);
      return sendFailedState(locale, data, previous) as S;
    }
  };
  return useActionState<S, FormData>(run, initial);
}

/**
 * Calls a server action from an event handler: when the request itself fails (offline, an error
 * page instead of the action's answer) the caller gets `failed` instead of an exception that would
 * replace the page. Next's own signals (redirect, notFound) still go through.
 */
export async function callAction<T>(call: () => Promise<T>, failed: T): Promise<T> {
  try {
    return await call();
  } catch (error) {
    rethrowNextSignal(error);
    console.error('action request failed', error);
    return failed;
  }
}
