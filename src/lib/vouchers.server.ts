import 'server-only';
import { getVouchers, isApiError, type Locale, type Vouchers } from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

/** The vouchers page exists only while the store has vouchers or cashback on (`Layout.features.vouchers`). */
export async function vouchersOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.vouchers);
  } catch {
    return false;
  }
}

/**
 * The vouchers page's read. Customer only: without the customer's token (a guest token is not
 * enough) → `signed-out`, never a guest session. `not-found` = the store has both switches off.
 */
export async function loadVouchers(locale: Locale): Promise<AccountResult<Vouchers>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await getVouchers(storefrontClient(), { locale, token }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('vouchers failed to load', error);
    return { status: 'error' };
  }
}
