import 'server-only';
import { getInsurance, isApiError, type InsurancePage, type Locale } from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

/** The insurance page exists only while the store takes insurance prescriptions (`Layout.features.insurance`). */
export async function insuranceOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.insurance);
  } catch {
    return false;
  }
}

/** The insurance page's read. Customer only: without the customer's token → `signed-out`, never a guest session. */
export async function loadInsurance(locale: Locale): Promise<AccountResult<InsurancePage>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await getInsurance(storefrontClient(), { locale, token }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('insurance failed to load', error);
    return { status: 'error' };
  }
}
