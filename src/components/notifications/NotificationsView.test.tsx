/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale, NotificationsPage } from '@/sdk';
import { notificationsFixture } from '@/test/fixtures';
import type { MarkAllReadAction, MarkReadAction } from './helpers';
import { NotificationsView, type NotificationsResult } from './NotificationsView';

// The fixture was recorded with the mock's clock: 901 arrived "now", 902 a day earlier.
const now = new Date('2026-09-29T10:00:00Z');

function setup(result: NotificationsResult, locale: Locale = 'en') {
  const markRead = vi.fn<MarkReadAction>(async () => undefined);
  const markAllRead = vi.fn<MarkAllReadAction>(async () => undefined);
  const view = render(<NotificationsView result={result} locale={locale} now={now} timeZone="UTC" markRead={markRead} markAllRead={markAllRead} />);
  return { ...view, markRead, markAllRead };
}

const ok = (data: NotificationsPage): NotificationsResult => ({ status: 'ok', data });
const item = (id: number) => screen.getAllByTestId('notification').find((node) => node.querySelector(`#notification-${id}-title`))!;

// jsdom can't navigate; stop link clicks at the document once React has seen them.
const stopNavigation = (event: Event) => {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
};
beforeEach(() => document.addEventListener('click', stopNavigation));
afterEach(() => document.removeEventListener('click', stopNavigation));

describe('NotificationsView', () => {
  it.each([
    ['en', 'Notifications', '24 unread', 'Mark all as read', 'Mark as read'],
    ['ar', 'الإشعارات', '24 غير مقروءة', 'تحديد الكل كمقروء', 'تحديد كمقروء'],
  ] as const)('lists the notifications with their read state (%s)', (locale, heading, unread, markAll, markOne) => {
    const data = notificationsFixture(locale);
    setup(ok(data), locale);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
    expect(screen.getByTestId('notifications-unread')).toHaveTextContent(unread);
    expect(screen.getByRole('button', { name: markAll })).toBeInTheDocument();

    const items = screen.getAllByTestId('notification');
    expect(items).toHaveLength(data.items.length);
    data.items.forEach((notification, index) => {
      expect(items[index]).toHaveTextContent(notification.title);
      expect(items[index]).toHaveAttribute('data-read', String(notification.read));
    });

    // One "mark as read" per unread item; the read one (903) has none.
    const unreadCount = data.items.filter((n) => !n.read).length;
    expect(screen.getAllByRole('button', { name: markOne })).toHaveLength(unreadCount);
    expect(within(item(903)).queryByRole('button')).toBeNull();
    expect(item(903)).toHaveAttribute('data-read', 'true');
  });

  it.each(['en', 'ar'] as const)('links each notification to its target (%s)', (locale) => {
    setup(ok(notificationsFixture(locale)), locale);

    expect(within(item(902)).getByRole('link')).toHaveAttribute('href', `/${locale}/products/list/125`);
    expect(within(item(903)).getByRole('link')).toHaveAttribute('href', `/${locale}/forms/prescriptions`);
    expect(within(item(910)).getByRole('link')).toHaveAttribute('href', `/${locale}/products/deals`);
    // No target → plain content, not clickable.
    expect(within(item(901)).queryByRole('link')).toBeNull();
  });

  it('shows when each notification arrived, in the shopper language', () => {
    setup(ok(notificationsFixture('en')));
    const time = item(902).querySelector('time')!;
    expect(time).toHaveAttribute('dateTime', '2026-09-28T10:00:00.000Z');
    expect(time).toHaveTextContent('yesterday');
    expect(item(901).querySelector('time')).toHaveTextContent('now');
  });

  it('renders the image when the notification has one', () => {
    const data = notificationsFixture('en');
    data.items[0] = { ...data.items[0], image: 'https://cdn.test/notification.jpg' };
    setup(ok(data));
    expect(item(data.items[0].id).querySelector('img')).toHaveAttribute('src', 'https://cdn.test/notification.jpg');
    expect(item(902).querySelector('img')).toBeNull();
  });

  it('marks one notification as read', async () => {
    const { markRead } = setup(ok(notificationsFixture('en')));
    fireEvent.click(within(item(902)).getByRole('button', { name: 'Mark as read' }));
    await waitFor(() => expect(markRead).toHaveBeenCalledTimes(1));
    expect(markRead.mock.calls[0].slice(0, 2)).toEqual(['en', 902]);
  });

  it('marks everything as read', async () => {
    const { markAllRead } = setup(ok(notificationsFixture('ar')), 'ar');
    fireEvent.click(screen.getByRole('button', { name: 'تحديد الكل كمقروء' }));
    await waitFor(() => expect(markAllRead).toHaveBeenCalledTimes(1));
    expect(markAllRead.mock.calls[0][0]).toBe('ar');
  });

  it('marks an unread notification as read when its link is opened', () => {
    const { markRead } = setup(ok(notificationsFixture('en')));
    fireEvent.click(within(item(902)).getByRole('link'));
    expect(markRead).toHaveBeenCalledTimes(1);
    expect(markRead.mock.calls[0].slice(0, 2)).toEqual(['en', 902]);
  });

  it('does not mark again when opening a read notification or clicking one without a link', () => {
    const { markRead } = setup(ok(notificationsFixture('en')));
    fireEvent.click(within(item(903)).getByRole('link'));
    fireEvent.click(within(item(901)).getByText('Your order is on its way'));
    expect(markRead).not.toHaveBeenCalled();
  });

  it('says so when everything is read', () => {
    const data = notificationsFixture('en');
    data.items = data.items.map((n) => ({ ...n, read: true }));
    data.unreadCount = 0;
    setup(ok(data));
    expect(screen.getByTestId('notifications-unread')).toHaveTextContent("You're all caught up");
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getAllByTestId('notification').every((node) => node.dataset.read === 'true')).toBe(true);
  });

  it.each([
    ['anonymous', { status: 'anonymous' } as NotificationsResult],
    ['empty list', ok({ items: [], pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 }, unreadCount: 0 })],
  ])('shows a friendly empty state (%s)', (_name, result) => {
    setup(result);
    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('Nothing here yet');
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/en');
    expect(screen.queryByTestId('notification')).toBeNull();
    expect(screen.queryByTestId('notifications-unread')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('notifications-pagination')).toBeNull();
  });

  it('shows the empty state in Arabic', () => {
    setup({ status: 'anonymous' }, 'ar');
    expect(screen.getByTestId('notifications-empty')).toHaveTextContent('لا يوجد شيء هنا بعد');
    expect(screen.getByRole('link', { name: 'تابع التسوق' })).toHaveAttribute('href', '/ar');
  });

  it('explains when the notifications could not be loaded', () => {
    setup({ status: 'error' });
    expect(screen.getByRole('alert')).toHaveTextContent('Notifications are unavailable');
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/en/notifications');
  });
});

describe('NotificationsView pagination', () => {
  const onPage = (page: number, locale: Locale = 'en') => {
    const data = notificationsFixture(locale);
    data.pagination = { ...data.pagination, page };
    return setup(ok(data), locale);
  };
  const nav = () => screen.getByTestId('notifications-pagination');

  it('has only "next" on the first page', () => {
    onPage(1);
    expect(nav()).toHaveTextContent('Page 1 of 3');
    expect(within(nav()).queryByRole('link', { name: /Previous/ })).toBeNull();
    expect(within(nav()).getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/en/notifications?page=2');
  });

  it('has both links in the middle', () => {
    onPage(2);
    expect(within(nav()).getByRole('link', { name: /Previous/ })).toHaveAttribute('href', '/en/notifications');
    expect(within(nav()).getByRole('link', { name: /Next/ })).toHaveAttribute('href', '/en/notifications?page=3');
  });

  it('has only "previous" on the last page', () => {
    onPage(3);
    expect(within(nav()).getByRole('link', { name: /Previous/ })).toHaveAttribute('href', '/en/notifications?page=2');
    expect(within(nav()).queryByRole('link', { name: /Next/ })).toBeNull();
  });

  it('is translated in Arabic', () => {
    onPage(1, 'ar');
    expect(nav()).toHaveTextContent('صفحة 1 من 3');
    expect(within(nav()).getByRole('link', { name: /التالي/ })).toHaveAttribute('href', '/ar/notifications?page=2');
  });

  it('is hidden when everything fits on one page', () => {
    const data = notificationsFixture('en');
    data.pagination = { page: 1, perPage: 10, total: 3, totalPages: 1 };
    setup(ok(data));
    expect(screen.queryByTestId('notifications-pagination')).toBeNull();
  });
});
