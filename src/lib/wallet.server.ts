import 'server-only';
import { getWallet, isApiError, type Locale, type Wallet } from '@/sdk';
import type { AccountResult } from './account.server';
import { customerToken } from './session';
import { loadLayout, storefrontClient } from './storefront.server';

/** History entries on one page. */
export const WALLET_PER_PAGE = 20;

/** The wallet page exists only while the store has the wallet on (`Layout.features.wallet`). */
export async function walletOn(locale: Locale): Promise<boolean> {
  try {
    return Boolean((await loadLayout(locale)).features.wallet);
  } catch {
    return false;
  }
}

/**
 * The wallet page's read. Customer only: without the customer's token (a guest token is not
 * enough) → `signed-out`, never a guest session. `not-found` = the store has the wallet off.
 */
export async function loadWallet(locale: Locale, page: number): Promise<AccountResult<Wallet>> {
  const token = await customerToken();
  if (!token) return { status: 'signed-out' };
  try {
    return { status: 'ok', data: await getWallet(storefrontClient(), { locale, token }, page, WALLET_PER_PAGE) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'signed-out' };
    if (isApiError(error) && error.kind === 'not_found') return { status: 'not-found' };
    console.error('wallet failed to load', error);
    return { status: 'error' };
  }
}
