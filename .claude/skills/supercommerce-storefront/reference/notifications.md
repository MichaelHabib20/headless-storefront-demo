# Notifications

Page: `/[locale]/notifications` (`src/app/[locale]/notifications/page.tsx`), components in
`src/components/notifications/`, strings in `src/lib/messages/notifications.ts`. Entry point (bell)
gated by `layout.features.notifications`; its badge is `me.counts.unreadNotifications` ([session.md](session.md)).

## Data

| Endpoint | SDK (`@/sdk`) | Returns |
|---|---|---|
| `GET /notifications?page&perPage` | `getNotifications(client, ctx, { page, perPage })` | `NotificationsPage`, newest first. **Read-only: never marks anything read.** |
| `POST /notifications/{id}/read` | `markNotificationRead(client, ctx, id)` | `{ unreadCount }` — for this shopper only |
| `POST /notifications/read-all` | `markAllNotificationsRead(client, ctx)` | `{ unreadCount: 0 }` |

```ts
interface Notification {
  id: number;
  title: string;                 // translated by the API
  body: string | null;
  image: string | null;
  target: Target | null;         // null = not clickable
  createdAt: string;             // ISO date-time
  read: boolean;                 // read by THIS shopper
}
interface NotificationsPage { items: Notification[]; pagination: Pagination; unreadCount: number }
```

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| Which notifications this shopper gets (guests get broadcasts only) and their order | List / card design, unread styling |
| `read` per item, `unreadCount`, `pagination` | Showing "24 unread", pager style, `perPage` (page uses 10) |
| Where a notification leads (`target`) | Link styling (always `<TargetLink>`) |
| `createdAt` | Date format: relative ("yesterday") or absolute, via `Intl` — display only |

## How the page works

- `page.tsx` reads with `shopperContext(locale)`. **No token → friendly empty state, no API call, no
  guest created.** A 401 → the same empty state. Other failures → an error block (`role="alert"`).
- `NotificationsView` renders heading, `unreadCount`, "Mark all as read" (only when `unreadCount > 0`),
  the list (`NotificationItem`), and `NotificationsPagination` (local prev/next from `pagination`).
- Server actions (`actions.ts`): `markNotificationReadAction(locale, id)` and
  `markAllNotificationsReadAction(locale)` → `ensureShopperContext` → SDK →
  `revalidatePath('/[locale]', 'layout')` (list + header badge). The view binds them per item.
- Opening an unread notification's link marks it read: `OpenMarksRead` (client) calls the bound action
  in the click capture phase; navigation is never blocked.
- Helpers (`helpers.ts`): `formatNotificationDate` (Intl `RelativeTimeFormat` / `DateTimeFormat`,
  `ar-EG` digits in Arabic), `formatCount`, `fill('{count} unread')`, `pageFromQuery`, `notificationsPageHref`.

## Rules

1. **Reading must not mark read.** Never call a mark endpoint on render, in `useEffect` on load, on
   scroll/visibility, or from a GET. Only a click (button or opening the link) marks read.
2. **Unread state and counts come from the API** (`read`, `unreadCount`, `me.counts.unreadNotifications`).
   Never count unread items yourself or keep "seen" ids in the browser.
3. **Links only via `<TargetLink>`**; `target: null` renders plain content. No `href` from `id`.
4. **Dates are display only.** Format `createdAt` with `formatNotificationDate`; never sort, filter or
   group by date (the backend orders the list).
5. **Never create a guest on render** (see [session.md](session.md)). Marking read happens in server
   actions only.

## Recipes

- **Bell with a badge in the header** → `me.counts.unreadNotifications`, link to `routes.notifications(locale)`.
- **"Mark as read when the notification scrolls into view"** → not allowed (reading ≠ read); needs a
  product decision + explicit action.
- **Show images bigger / a card grid** → `Notifications.module.css`; data stays the same.
- **Group by "Today / Earlier"** → display-only grouping of the given order is OK; never reorder.
- **Delete a notification** → no endpoint → "needs backend support".
- **New UI text** → `src/lib/messages/notifications.ts` (`en` + `ar`, keys prefixed `notifications`).

## Tests to update

- `src/components/notifications/NotificationsView.test.tsx` — `notificationsFixture(locale)`
  (10 of 25, #903 read, 24 unread, 3 pages): read/unread, target links, empty/error, pagination, actions.
- `src/components/notifications/helpers.test.ts` — date/count formatting, `?page` parsing.
- `e2e/notifications.spec.ts` — mock API: list, mark one, mark all, opening marks read, reading never
  marks read (reload + `/me` check), pagination, Arabic, anonymous visitor gets no `sc_guest`.
