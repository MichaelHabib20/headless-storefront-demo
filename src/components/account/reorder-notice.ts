import type { ReorderResult } from '@/sdk';

/**
 * "Order again" goes to the cart page and tells the shopper what the backend skipped. The list
 * travels in sessionStorage (this tab only, read once): it holds the API's product names and
 * reasons — no token, nothing personal beyond what the cart page shows anyway.
 */
export type SkippedItems = ReorderResult['skipped'];

const KEY = 'sc_reorder_notice';

export function keepReorderNotice(skipped: SkippedItems): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(skipped));
  } catch {
    // storage blocked (private mode): the cart still has the items, only the notice is lost
  }
}

/** The notice left by "Order again", or null; it is shown once. */
export function takeReorderNotice(): SkippedItems | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter(
      (item): item is SkippedItems[number] => typeof item === 'object' && item !== null && typeof item.name === 'string' && typeof item.reason === 'string',
    );
  } catch {
    return null;
  }
}
