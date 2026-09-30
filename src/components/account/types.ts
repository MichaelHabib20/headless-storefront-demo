import type { Address, Locale } from '@/sdk';
import type { SkippedItems } from './reorder-notice';

/*
 * What the account server actions (src/app/[locale]/account/…/actions.ts) give back to the
 * components. They never throw for API errors: a failure carries a message to show.
 */

/** Delete / make default: the whole address book as the API now has it. */
export type AddressBookResult = { ok: true; items: Address[] } | { ok: false; message: string };
export type AddressBookAction = (locale: Locale, addressId: number) => Promise<AddressBookResult>;

/** Saving the address form. On success the action redirects; otherwise this is shown. */
export interface AddressFormState {
  /** A general message (the API's, or ours when the store can't be reached). */
  message?: string;
  /** The API's 422 `fields`, first message of each, under the names the API sent. */
  fieldErrors?: Record<string, string>;
}
export type SaveAddressAction = (state: AddressFormState, formData: FormData) => Promise<AddressFormState>;

/** Cancel: the page is refreshed with the order as the API now has it; this is the message to announce. */
export type CancelOrderResult = { ok: boolean; message: string };
export type CancelOrderAction = (locale: Locale, orderId: string, reasonId: number, note: string | null) => Promise<CancelOrderResult>;

/** Order again: what the API skipped (names and reasons as it wrote them). */
export type ReorderActionResult = { ok: true; skipped: SkippedItems } | { ok: false; message: string };
export type ReorderAction = (locale: Locale, orderId: string) => Promise<ReorderActionResult>;
