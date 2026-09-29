import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNotifications, isApiError, isLocale, type Locale } from '@/sdk';
import { pageFromQuery } from '@/components/notifications/helpers';
import { NotificationsView, type NotificationsResult } from '@/components/notifications/NotificationsView';
import { translator } from '@/lib/i18n';
import { shopperContext } from '@/lib/shopper.server';
import { storefrontClient } from '@/lib/storefront.server';
import { markAllNotificationsReadAction, markNotificationReadAction } from './actions';

export const dynamic = 'force-dynamic';

const PER_PAGE = 10;

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('notificationsTitle') : undefined, robots: { index: false } };
}

/**
 * Reads only: GET /notifications never marks anything as read, and rendering never
 * creates a guest session (shopperContext, not ensureShopperContext).
 */
async function loadNotifications(locale: Locale, page: number): Promise<NotificationsResult> {
  const context = await shopperContext(locale);
  if (!context.token) return { status: 'anonymous' };
  try {
    return { status: 'ok', data: await getNotifications(storefrontClient(), context, { page, perPage: PER_PAGE }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'anonymous' };
    console.error('notifications failed to load', error);
    return { status: 'error' };
  }
}

export default async function NotificationsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { page } = await searchParams;

  const result = await loadNotifications(locale, pageFromQuery(page));

  return (
    <NotificationsView
      result={result}
      locale={locale}
      now={new Date()}
      markRead={markNotificationReadAction}
      markAllRead={markAllNotificationsReadAction}
    />
  );
}
