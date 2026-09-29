'use server';

import { revalidatePath } from 'next/cache';
import { isLocale, markAllNotificationsRead, markNotificationRead, type Locale } from '@/sdk';
import { ensureShopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';

/**
 * Notification writes. Server actions are the only place allowed to use
 * ensureShopperContext (it may start a guest session); pages only read.
 * Failures are logged and swallowed: the refreshed page shows the backend's real state.
 */

/** Every page under /[locale] — the list AND the header's unread badge (loaded by the layout). */
function refreshShopperViews() {
  revalidatePath('/[locale]', 'layout');
}

/** Marks one notification as read (per-item button, and opening its link). */
export async function markNotificationReadAction(locale: Locale, notificationId: number): Promise<void> {
  if (!isLocale(locale) || !Number.isInteger(notificationId) || notificationId < 1) return;
  try {
    await markNotificationRead(storefrontClient(), await ensureShopperContext(locale), notificationId);
  } catch (error) {
    console.error('marking a notification as read failed', error);
  }
  refreshShopperViews();
}

/** "Mark all as read". */
export async function markAllNotificationsReadAction(locale: Locale): Promise<void> {
  if (!isLocale(locale)) return;
  try {
    await markAllNotificationsRead(storefrontClient(), await ensureShopperContext(locale));
  } catch (error) {
    console.error('marking all notifications as read failed', error);
  }
  refreshShopperViews();
}
