import 'server-only';
import { getPrescriptionCancellationReasons, getPrescriptionForm, getPrescriptions, isApiError, type CancellationReason, type Locale, type PrescriptionForm, type PrescriptionsPage } from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { storefrontClient } from './storefront.server';

/** Prescriptions on the page. */
export const PRESCRIPTIONS_PER_PAGE = 10;

/**
 * Reads of the prescriptions page. Customer only: without the customer's token (a guest token is
 * not enough) → `signed-out`, never a guest session. `not-found` = the store takes no prescriptions.
 */
async function customerRead<T>(locale: Locale, call: (token: string) => Promise<T>): Promise<AccountResult<T>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await call(token) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('prescriptions failed to load', error);
    return { status: 'error' };
  }
}

export function loadPrescriptionForm(locale: Locale): Promise<AccountResult<PrescriptionForm>> {
  return customerRead(locale, (token) => getPrescriptionForm(storefrontClient(), { locale, token }));
}

export function loadPrescriptions(locale: Locale, page: number): Promise<AccountResult<PrescriptionsPage>> {
  return customerRead(locale, (token) => getPrescriptions(storefrontClient(), { locale, token }, page, PRESCRIPTIONS_PER_PAGE));
}

/** The API's reasons, or null when they could not be loaded (the dialog then says so). */
export async function loadPrescriptionCancellationReasons(locale: Locale): Promise<CancellationReason[] | null> {
  const reasons = await customerRead(locale, (token) => getPrescriptionCancellationReasons(storefrontClient(), { locale, token }));
  return reasons.status === 'ok' ? reasons.data.items : null;
}
