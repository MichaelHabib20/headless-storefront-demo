/**
 * Campaign click ids (`fbclid`, `gclid`, `ttclid`, `sccid`) from the landing URL, kept in an
 * httpOnly cookie for 7 days (src/middleware.ts) and sent with every server-side marketing event
 * (src/lib/marketing.server.ts → EventRequest.clickIds). Pure helpers, no I/O.
 */
export const CLICK_IDS_COOKIE = 'sc_click_ids';
export const CLICK_ID_PARAMS = ['fbclid', 'gclid', 'ttclid', 'sccid'] as const;
export const CLICK_IDS_MAX_AGE = 60 * 60 * 24 * 7;

export type ClickIds = Partial<Record<(typeof CLICK_ID_PARAMS)[number], string>>;

/** What a click id or a Meta browser id may look like (anything else is dropped, never forwarded). */
export const CLICK_ID = /^[\w.\-~]{1,500}$/;

/** The click ids stored in the cookie (unknown keys and odd values dropped); null when none. */
export function parseClickIds(raw: string | undefined | null): ClickIds | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    const ids: ClickIds = {};
    for (const key of CLICK_ID_PARAMS) {
      const id = value?.[key];
      if (typeof id === 'string' && CLICK_ID.test(id)) ids[key] = id;
    }
    return Object.keys(ids).length ? ids : null;
  } catch {
    return null;
  }
}

/**
 * The cookie value after a landing URL: the URL's click ids replace the stored ones of the same
 * kind (the latest campaign wins), the others stay. Null when the URL has none (cookie untouched).
 */
export function clickIdsCookie(search: URLSearchParams, current: string | undefined | null): string | null {
  const found: ClickIds = {};
  for (const key of CLICK_ID_PARAMS) {
    const id = search.get(key);
    if (id && CLICK_ID.test(id)) found[key] = id;
  }
  if (!Object.keys(found).length) return null;
  return JSON.stringify({ ...(parseClickIds(current) ?? {}), ...found });
}
