/**
 * Small shared rules of the site shell. Dismissals are remembered in plain (non-httpOnly) cookies so
 * the server can leave a dismissed banner out of the page instead of flashing it.
 */
export const APP_BANNER_COOKIE = 'sc_app_banner';
export const FLOATING_BANNER_COOKIE = 'sc_floating_banner';

/** The area chooser opens on this window event (the bottom nav's `area` item sends it). */
export const OPEN_AREA_EVENT = 'sc:open-area-chooser';

/** Days a dismissal is remembered. */
export const DISMISS_DAYS = { appBanner: 30, floatingBanner: 1 } as const;

/** The floating banner stays dismissed until the merchant shows another one (the cookie holds its id). */
export function floatingBannerDismissed(cookie: string | undefined, bannerId: number): boolean {
  return cookie === String(bannerId);
}

/** Remembers a dismissal in the browser (client components only). */
export function rememberDismissal(name: string, value: string, days: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${days * 86400}; Path=/; SameSite=Lax`;
}

/**
 * Whether the area chooser opens by itself: the store asks for an area before prices
 * (`areaSelection.required`), the shopper has a session but no area yet. Visitors without a session
 * only see it when they open it (no guest is created to show it).
 */
export function areaChooserForced(required: boolean, me: { authenticated: boolean; area?: unknown } | null): boolean {
  return required && Boolean(me?.authenticated) && !me?.area;
}
