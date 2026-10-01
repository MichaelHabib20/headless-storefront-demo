import { isLocale, type EventName } from '@/sdk';
import { trackServerEvent } from '@/lib/marketing.server';

/**
 * POST /api/events: the browser's marketing events (src/lib/marketing.ts, sent with sendBeacon)
 * forwarded to the backend's POST /events with the visitor's cookies (click ids, Meta ids, the
 * shopper token stay httpOnly: the browser never sees them). Only the fields of the contract's
 * EventRequest that the browser may know are read; the answer is always 204.
 */
const NAMES: readonly EventName[] = ['page_view', 'view_item', 'view_item_list', 'search', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info', 'purchase', 'sign_up', 'login', 'add_to_wishlist', 'select_promotion'];
const MAX_BODY = 8_000;

const text = (value: unknown, max: number): string | null => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

export async function POST(request: Request): Promise<Response> {
  const raw = await request.text().catch(() => '');
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const name = body?.name;
  if (!isLocale(body?.locale) || typeof name !== 'string' || !(NAMES as readonly string[]).includes(name)) return new Response(null, { status: 400 });

  const page = body.page as { path?: unknown; referrer?: unknown } | null | undefined;
  const path = text(page?.path, 2000);
  await trackServerEvent(body.locale, {
    name: name as EventName,
    eventId: text(body.eventId, 100),
    productIds: Array.isArray(body.productIds) ? body.productIds.filter((id): id is number => Number.isInteger(id) && (id as number) > 0).slice(0, 50) : [],
    orderId: text(body.orderId, 64),
    searchTerm: text(body.searchTerm, 200),
    // Only a path of this site (never another origin) is taken as the page.
    page: path && path.startsWith('/') && !path.startsWith('//') ? { path, referrer: text(page?.referrer, 2000) } : null,
  });
  return new Response(null, { status: 204 });
}
