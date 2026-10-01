'use client';

import { useEffect } from 'react';
import type { Locale } from '@/sdk';
import { track, trackPurchaseOnce, type MarketingEvent } from '@/lib/marketing';

/**
 * Fires one marketing event when the page is shown (browser pixels + POST /events through our route
 * handler). Analytics only: it never changes what a page shows or the shopper's data. `onceKey`
 * (the checkout reference) makes it fire once per key in this tab session (the purchase).
 * Renders nothing.
 */
export function TrackEvent({ locale, event, onceKey }: { locale: Locale; event: MarketingEvent | null; onceKey?: string }) {
  const key = event ? JSON.stringify([locale, event, onceKey ?? null]) : null;

  useEffect(() => {
    if (!key) return;
    const [eventLocale, payload, once] = JSON.parse(key) as [Locale, MarketingEvent, string | null];
    if (once) trackPurchaseOnce(eventLocale, once, payload);
    else track(eventLocale, payload);
  }, [key]);

  return null;
}
