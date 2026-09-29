import { defineMessages } from './define';

/**
 * UI strings for notifications. Owned by agent G (notifications). Keep en and ar in sync.
 * Notification titles and bodies come translated from the API; these are only the page's own labels.
 * `{count}`, `{page}`, `{total}` are filled by `fill()` in src/components/notifications/helpers.ts.
 */
export const notificationsMessages = defineMessages({
  en: {
    notificationsTitle: 'Notifications',
    notificationsUnreadCount: '{count} unread',
    notificationsAllRead: "You're all caught up",
    notificationsMarkAllRead: 'Mark all as read',
    notificationsMarkRead: 'Mark as read',
    notificationsUnread: 'Unread',
    notificationsEmptyTitle: 'Nothing here yet',
    notificationsEmptyText: 'Order updates and offers will show up here.',
    notificationsEmptyCta: 'Continue shopping',
    notificationsErrorTitle: 'Notifications are unavailable',
    notificationsErrorText: "We couldn't load your notifications. Please try again in a moment.",
    notificationsRetry: 'Try again',
    notificationsPagination: 'Notification pages',
    notificationsPrevious: 'Previous',
    notificationsNext: 'Next',
    notificationsPageOf: 'Page {page} of {total}',
  },
  ar: {
    notificationsTitle: 'الإشعارات',
    notificationsUnreadCount: '{count} غير مقروءة',
    notificationsAllRead: 'اطّلعت على كل الإشعارات',
    notificationsMarkAllRead: 'تحديد الكل كمقروء',
    notificationsMarkRead: 'تحديد كمقروء',
    notificationsUnread: 'غير مقروء',
    notificationsEmptyTitle: 'لا يوجد شيء هنا بعد',
    notificationsEmptyText: 'ستظهر هنا تحديثات طلباتك والعروض.',
    notificationsEmptyCta: 'تابع التسوق',
    notificationsErrorTitle: 'الإشعارات غير متاحة',
    notificationsErrorText: 'تعذر تحميل الإشعارات. حاول مرة أخرى بعد قليل.',
    notificationsRetry: 'حاول مرة أخرى',
    notificationsPagination: 'صفحات الإشعارات',
    notificationsPrevious: 'السابق',
    notificationsNext: 'التالي',
    notificationsPageOf: 'صفحة {page} من {total}',
  },
});
