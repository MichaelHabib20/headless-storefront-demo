import 'server-only';
import { getBankDetails, isApiError, type BankDetails, type Locale } from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

/** The page exists only while the store asks for refund bank details (`Layout.features.bankDetails`). */
export async function bankDetailsOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.bankDetails);
  } catch {
    return false;
  }
}

/** The page's read. Customer only: without the customer's token → `signed-out`, never a guest session. */
export async function loadBankDetails(locale: Locale): Promise<AccountResult<BankDetails>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await getBankDetails(storefrontClient(), { locale, token }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('bank details failed to load', error);
    return { status: 'error' };
  }
}
