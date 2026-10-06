import type { Locale, Vouchers } from '@/sdk';

/** What adding a code answers to the page: the backend's message and list, or its reason for refusing. */
export type AddVoucherResult = { ok: true; message: string; vouchers: Vouchers } | { ok: false; message: string };

export type AddVoucherAction = (locale: Locale, code: string) => Promise<AddVoucherResult>;
