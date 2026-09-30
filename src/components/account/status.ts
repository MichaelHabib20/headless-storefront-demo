/**
 * How an order status looks. Styling only: the text is always the API's `status.label`, and what
 * the shopper may do comes from `order.actions` — never from the status code.
 * Unknown codes (the backend can add some any time) get the default look.
 */
export type StatusTone = 'progress' | 'done' | 'stopped' | 'default';

const TONES: Readonly<Record<string, StatusTone>> = {
  pending: 'progress',
  placed: 'progress',
  confirmed: 'progress',
  processing: 'progress',
  preparing: 'progress',
  shipped: 'progress',
  out_for_delivery: 'progress',
  ready_for_pickup: 'progress',
  delivered: 'done',
  picked_up: 'done',
  completed: 'done',
  cancelled: 'stopped',
  failed: 'stopped',
};

export function statusTone(code: string): StatusTone {
  return Object.hasOwn(TONES, code) ? TONES[code] : 'default';
}
