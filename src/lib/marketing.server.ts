import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { trackEvent, type EventName, type EventRequest, type Locale } from '@/sdk';
import { CLICK_ID, CLICK_IDS_COOKIE, parseClickIds } from './click-ids';
import { shopperToken } from './shopper.server';
import { storefrontClient } from './storefront.server';

/**
 * Server-side marketing events (POST /events) from server actions and route handlers. The request
 * carries ids only; the backend looks up names and prices. Added here from the visitor's cookies:
 * the campaign click ids the middleware kept (`sc_click_ids`), the Meta browser ids (`_fbp`, `_fbc`)
 * and the shopper's token (when there is one). Never throws.
 */
export interface ServerEvent {
  name: EventName;
  eventId?: string | null;
  productIds?: number[];
  orderId?: string | null;
  searchTerm?: string | null;
  /** The page the event happened on (a path of this storefront); defaults to the Referer's path. */
  page?: { path: string; referrer?: string | null } | null;
}

function refererPath(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

const text = (value: string | null | undefined, max: number) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null);

/** The EventRequest for this visitor (pure: the cookie values are passed in). */
export function eventRequest(event: ServerEvent, jar: { clickIds?: string | null; fbp?: string | null; fbc?: string | null }, referer: string | null): EventRequest {
  const path = text(event.page?.path, 2000) ?? refererPath(referer);
  const fbp = jar.fbp && CLICK_ID.test(jar.fbp) ? jar.fbp : null;
  const fbc = jar.fbc && CLICK_ID.test(jar.fbc) ? jar.fbc : null;
  return {
    name: event.name,
    eventId: text(event.eventId, 100) ?? `${event.name}-${randomUUID()}`,
    page: path ? { path: path.slice(0, 2000), referrer: text(event.page?.referrer, 2000) } : null,
    clickIds: parseClickIds(jar.clickIds),
    browser: fbp || fbc ? { fbp, fbc } : null,
    productIds: (event.productIds ?? []).filter((id) => Number.isInteger(id) && id > 0).slice(0, 50),
    orderId: text(event.orderId, 64),
    searchTerm: text(event.searchTerm, 200),
  };
}

/** Sends one event with the visitor's cookies. Failures are logged, never thrown. */
export async function trackServerEvent(locale: Locale, event: ServerEvent): Promise<void> {
  try {
    const jar = await cookies();
    const referer = (await headers()).get('referer');
    const body = eventRequest(event, { clickIds: jar.get(CLICK_IDS_COOKIE)?.value, fbp: jar.get('_fbp')?.value, fbc: jar.get('_fbc')?.value }, referer);
    await trackEvent(storefrontClient(), { locale, token: await shopperToken() }, body);
  } catch (error) {
    console.error('marketing event failed', error);
  }
}
