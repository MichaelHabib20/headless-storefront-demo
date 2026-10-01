# Site chrome (every page)

Data: `GET /api/customer/v3/layout` → `getLayout(client, locale)` → type `Layout`.
Loaded once per request in `src/app/[locale]/layout.tsx` with `loadLayout(locale)`.

| Field | Rendered by | Notes |
|---|---|---|
| `locale`, `direction` | `<html lang dir>` | Arabic is `rtl` |
| `store.name / logo / logoInverse / favicon / slogan` | `SiteHeader`, `SiteFooter`, metadata | Always use the API logo, never a file in the repo |
| `announcement` (`{text, icon}` or `null`) | `AnnouncementBar` | The merchant's softbar. `null` = switched off → render nothing |
| `topBar.message / hotline / links / appLinks` | `TopBar` | `links` are `{label, target}` (magazine, blog) |
| `header.searchPlaceholder` | `SiteHeader` search | Search results page is not built yet (coming soon) |
| `header.shortcuts` | `SiteHeader`, `MobileMenu` | Merchant buttons like "Our branches" `{label, icon, target}` |
| `navigation` | `DesktopNav`, `MobileMenu` | Tree of `{label, target, image, badge, children}` (max 3 levels) |
| `footer.about / contact / links / social / appLinks / newsletter.text` | `SiteFooter` | `links` = CMS pages + forms; `social[].platform` is detected from the URL by the backend |
| `whatsapp` (`{number, url}` or `null`) | `WhatsAppButton` | |
| `currency` | — | Prices already carry their currency |
| `legal` (`{privacy, terms, cookies}` Targets) | `LegalLinks` (footer), `CookieConsent` | The merchant's legal CMS pages; null → no link ([content.md](content.md)) |
| `appBanner`, `topBanner`, `floatingBanner` | `AppBanner`, `TopBanner`, `FloatingBanner` | Null → nothing; dismissals are cookies ([shell.md](shell.md)) |
| `mobileNav` | `MobileBottomNav` + more sheet | Phones only; items, labels, icons, badges from the API ([shell.md](shell.md)) |
| `areaSelection` + `Me.area` | `AreaChooser` | Multi-inventory stores only ([shell.md](shell.md)) |
| `storeStatus` | `StoreClosedNotice` | Only when `acceptingOrders` is false |
| `features` | see below | |

## Features

`layout.features` are the store's switches. Use them to show or hide **entry points** (links,
icons, pages). Never re-implement the rule behind them.

| Feature | UI effect |
|---|---|
| `signup` | Show "Create account" links |
| `compare` | Compare icon/links → `routes.compare`, badge `me.counts.compare` ([wishlist-compare.md](wishlist-compare.md)) |
| `wishlist` | Heart icon in the header, badge `me.counts.wishlist` |
| `notifications` | Bell icon → `routes.notifications`, badge `me.counts.unreadNotifications` ([notifications.md](notifications.md)) |
| `orderTracking` | "Track order" link in the footer |
| `contactPage` | "Contact us" link |
| `branches` | "Branches" link |
| `prescriptions` | Prescription entry points |
| `cookieConsent` | Show `CookieConsent` |
| `newsletter` | Newsletter band in the footer (no subscribe API yet: the form says "coming soon") |
| `guestCanViewPrices` | Informational — prices already come back as `null` when hidden |
| `share` | Share button on product pages |

## Menu

- Top level → `DesktopNav` (hover/click mega panel, Escape closes) and `MobileMenu` (drawer with
  `<details>` accordions).
- Every item links with `TargetLink`. A menu item with `target: null` is a plain label.
- Menu colors/sizes from the old admin are **style** and are ignored: the theme owns them.

## Recipes

- **Different header look** → `SiteHeader.module.css`, `DesktopNav.module.css`. The data stays.
- **Add a footer column of fixed links** (e.g. "Help") → use `routes.*` from `src/lib/routing.ts`
  and i18n labels; gate by `features.*` where one exists.
- **Hide the WhatsApp button on mobile** → CSS in `FloatingActions.module.css`.
- **Tests to update**: `SiteChrome.test.tsx`, `e2e/home.spec.ts`, `e2e/mobile.spec.ts`.
