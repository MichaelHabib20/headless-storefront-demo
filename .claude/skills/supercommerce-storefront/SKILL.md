---
name: supercommerce-storefront
description: Rules, APIs and components for changing this SuperCommerce headless storefront (Next.js). Use for ANY change to pages, components, styles, copy, links, data loading or tests in this repo — especially the home page, header, footer, sections, product cards, prices (the locked money components), cart, wishlist, compare, notifications and the shopper session (guest/customer tokens, header counts).
---

# SuperCommerce storefront

This storefront is a client of the SuperCommerce **storefront API v3**. The backend owns
business logic (what to show, prices, links, rules). This repo owns the UI (how it looks).
Follow these rules even when a shortcut looks easier — `npm run verify` enforces most of
them and **blocks the deploy** when one is broken.

## The rules

1. **Only `src/sdk` talks to the backend.** Load data with SDK functions (`getLayout`,
   `getHome`, `getCart`, `getNotifications`...) through `src/lib/storefront.server.ts` and
   `src/lib/shopper.server.ts`. Never `fetch`, never call `/api/customer/...`, never use legacy
   fields (`image_type`, `item_id`, `discount_price`, `name_ar`...). If the SDK has no function for
   what you need → stop and report "this needs backend support". Do not invent endpoints.
2. **Never compute or format business values.** Prices, discounts, totals, remaining amounts, the
   minimum-order progress, stock, "can add to cart", "can check out", compare limits, unread counts,
   which sections exist and their order all come from the API. Money comes as ready-to-show text:
   put it on screen **only** with `<Money value={...} />`, `<Price price={...} locale={locale} />`
   or `<DiscountLabel price={...} />` from `@/money`. Never read `display` / `compareAtDisplay` /
   `discountLabel` yourself, never format money (`Intl.NumberFormat`, `toFixed`, `toLocaleString`,
   `` `${currency} ${amount}` ``), never do math or comparisons on `amount` / `compareAt` /
   `discountPercent` / `progressPercent`. Counts and quantities (not money): `formatNumber()` from
   `src/lib/numbers.ts`. **`src/money` belongs to SuperCommerce and is locked**: never edit it and
   never run `npm run money:lock` — change how money looks with `className` / `classNames` / `as`.
3. **Every link to backend content goes through the Target.** Render
   `<TargetLink target={x.target}>`. Never branch on `target.type`, never build URLs from
   slugs. The URL scheme lives in ONE file: `src/lib/routing.ts`.
4. **Content text comes translated from the API** (titles, menu labels, cart messages). UI strings
   you add (buttons, headings, labels) go in `src/lib/i18n.ts` or the area's
   `src/lib/messages/<area>.ts` — **both** `en` and `ar`.
5. **Everything works in Arabic (RTL).** Use logical CSS (`margin-inline-start`,
   `inset-inline-end`, `padding-inline`), never `left`/`right`. Arrows use
   `<Icon directional />`.
6. **Unknown is skipped, not guessed.** New section layouts fall back to the grid
   (`normalizeLayout`); unknown target types render as plain content. Never crash on data.
7. **Secrets stay on the server.** No `process.env` in `'use client'` files. No hardcoded
   store URLs or hosts. No `dangerouslySetInnerHTML`. Shopper tokens live only in httpOnly cookies.
8. **Reads never write.** Pages read with `shopperContext`; writes happen only in server actions
   with `withShopper`. Never create a guest session while rendering; a GET (or opening a
   page) never changes data — e.g. viewing notifications never marks them read.
9. **UI is yours.** Layout, spacing, colors, typography, component structure, copy — change
   freely. Theme tokens live in `src/app/globals.css`. The one folder that isn't yours is
   `src/money` (rule 2): style it from outside.
10. **Always finish with `npm run verify`** and fix every failure before you say you're done.
    Add or update tests for what you changed (see "Tests").

## Where things are

| Path | What |
|---|---|
| `contract/openapi.yaml` | The API contract (source of truth). Copied from the backend with `npm run contract:sync`. |
| `src/sdk/` | SDK: the only code that calls the API. `generated/api.ts` is generated — never edit it. |
| `src/money/` | **Locked, SuperCommerce's.** `Money`, `Price`, `DiscountLabel`: the only code that shows money. Style them from your components; never edit this folder (see its `README.md`) |
| `src/lib/` | Logic layer: `routing.ts` (Target → URL), `i18n.ts` + `messages/<area>.ts` (UI strings), `numbers.ts` (counts and quantities — never money), `home.ts`, `popup.ts`, `storefront.server.ts` (server data loading), `shopper.server.ts` (shopper session) |
| `src/components/ui/` | Building blocks: `TargetLink`, `ResponsiveImage`, `Rail`, `SectionHeading`, `Icon` |
| `src/components/layout/` | Site chrome: `AnnouncementBar`, `TopBar`, `SiteHeader`, `DesktopNav`, `MobileMenu`, `SiteFooter`, `CookieConsent`, `WhatsAppButton` |
| `src/components/home/` | Home blocks: `PromoStrip`, `CategoryTiles`, `BrandRail`, `PopupHost`, `sections/HomeSection` + `sections/BannerLayouts` |
| `src/components/product/ProductCard.tsx` | Product card |
| `src/components/notifications/` | Notifications page blocks, helpers, local pagination |
| `src/components/account/` | Address book, address form (drawn from the API), orders list/details, cancel dialog, reorder notice |
| `src/app/[locale]/layout.tsx` | Loads `layout`, renders chrome for every page |
| `src/app/[locale]/page.tsx` | The home page: composition of home blocks |
| `src/app/[locale]/<area>/page.tsx` + `actions.ts` | Shopper pages (reads) and their server actions (writes) |
| `src/app/[locale]/[...slug]/page.tsx` | "Coming soon" for routes that aren't built yet; the "no longer available" page (410) |
| `src/components/catalog/` + `src/lib/listing.ts`, `catalog.server.ts`, `resolve.ts` | Listings (one view for category, brand, list, tag, deals, search), filters, sort, category and brand indexes, unknown-path answers |
| `src/middleware.ts` | Locale prefix; asks `GET /resolve` for paths outside our routes (301/302/410/404) |
| `src/app/[locale]/checkout/` + `src/components/checkout/` | Checkout page, its server actions (the only `placeOrder`), result page |
| `src/app/[locale]/[...slug]/page.tsx` | "Coming soon" for routes that aren't built yet |
| `src/test/fixtures/v3/` | Recorded API responses (`npm run fixtures:record`) + shopper fixtures from the mock |
| `scripts/` | `check-rules.mjs` (architecture rules + the `src/money` lock in `money.lock.json`), `contract-check.mjs`, `mock-api.mjs` + `mock/shopper.mjs`, `record-fixtures.mjs` |

## Read before you change

| Task | Read |
|---|---|
| Anything on the home page (sections, banners, tiles, product rows, popups) | [reference/home.md](reference/home.md) |
| Prices and money anywhere (how they look, where they go) | [src/money/README.md](../../../src/money/README.md) |
| Header, top bar, menu, footer, softbar, WhatsApp, cookie notice | [reference/layout.md](reference/layout.md) |
| Links, URLs, new routes | [reference/targets.md](reference/targets.md) |
| What store settings exist and what the UI must do with them | [reference/layout.md#features](reference/layout.md) |
| Sign in / sign up | [reference/auth.md](reference/auth.md) |
| Guest sessions, tokens, header counts, "add" buttons, sign-in merge | [reference/session.md](reference/session.md) |
| Cart page, quantities, totals, checkout button, minimum order | [reference/cart.md](reference/cart.md) |
| Wishlist, compare, hearts, move to cart | [reference/wishlist-compare.md](reference/wishlist-compare.md) |
| Checkout, placing an order, payment return, the result page | [reference/checkout.md](reference/checkout.md) |
| Notifications page, bell badge, mark as read | [reference/notifications.md](reference/notifications.md) |
| Product page, options, gallery, notify-me, reviews, recommendations | [reference/product.md](reference/product.md) |
| Listings, filters, sort, search box, categories, brands, old URLs / redirects / 410 | [reference/catalog.md](reference/catalog.md) |
| Address book (form from the API), orders list/details, cancel, order again | [reference/account.md](reference/account.md) |
| Tests, the mock API and the verify pipeline | [reference/testing.md](reference/testing.md) |

## Common requests → how

| Request | Do | Don't |
|---|---|---|
| "Move brands above the sections" | Reorder blocks in `src/app/[locale]/page.tsx` | Filter/reorder `home.sections` (merchant order) |
| "Show 6 products per row" | `perView` on the `Rail` in `HomeSection.tsx` | Slice `section.products` to hide items |
| "Show the discount as a red badge" | Style `.discount` in `ProductCard.module.css` (the `className` of `<DiscountLabel>`) | Recompute `(compareAt - amount) / compareAt` |
| "Make the price bigger / red / old price first" | `className` / `classNames` on `<Price>` in your CSS module (flex `order` for the old price) | Edit `src/money`, rebuild the price from `amount` |
| "Show prices with 2 decimals / another currency sign / other digits" | It's the backend's text → report "needs backend support" | `Intl.NumberFormat`, `toFixed`, string replace on `display` |
| "Add a 'Free delivery' label on cards" | Only if a backend field says so — otherwise report "needs backend support" | Hardcode rules like `amount > 500` |
| "Show a free-delivery progress bar" | Only with a backend field (none in v3) → "needs backend support" | Hardcode a threshold or derive it from `summary.total` |
| "Compute the cart total" / "show what they save" | `<Money value={summary.total} />`, `summary.discount`, `item.lineTotal` | Sum lines, `unitPrice × quantity`, subtract prices |
| "Disable checkout when …" | Nothing to add: enable only on `checkout.allowed`, show `blockers[].message` | Your own enable/disable conditions |
| "Show 'add 50 EGP more'" | `<Money value={checkout.minimumOrder.remaining} />` or the `minimum_order` blocker message | `minimum - subtotal` |
| "Minimum-order progress bar" | `checkout.minimumOrder.progressPercent` as the bar width (CSS) | `(minimum - remaining) / minimum` |
| "Limit compare to 3" | It's `maxItems` from the backend → report a backend setting | Hardcode a number |
| "Cart / wishlist count in the header" | `me.counts.*` from `getMe` | `items.length` or a count in `localStorage` |
| "Mark notifications read when the page opens" | Not allowed: only a click marks read | Call mark-read on render / `useEffect` |
| "Add to cart / heart for guests" | Server action with `withShopper` | Create a guest while rendering; token in the browser |
| "Enable place order when …" / "preselect a payment method" | Nothing: `checkout.canPlaceOrder` and the backend's preselection (echo) | Own conditions, `methods[0]`, a default address |
| "Buy now" / "place the order from elsewhere" | Link to checkout; `placeOrderAction` is the only door | `placeOrder()` outside `src/app/[locale]/checkout/`, writing `expectedTotal` |
| "Add a new text/button" | Add the key to `en` **and** `ar` in `src/lib/i18n.ts` or `src/lib/messages/<area>.ts` | Hardcode English |
| "Link the logo somewhere else" | `routes.*` in `src/lib/routing.ts` | Write `'/en/...'` strings |
| "Clicking a size opens the matching variant" | Already: each option value is a `<TargetLink target={value.target}>` | Work out the variant from the chosen values |
| "Product quantity limit 10" | `purchase.maxQuantity` / `quantityStep` from the API → `ProductActions` `quantity` | Hardcode limits |
| "Add a filter / sort option" | Backend facet or sort option; links are its `query` strings (`listingHref`) | Build `?brands=…` or sort `items` yourself |
| "Show N results" | `pagination.total` with `formatNumber()` | `items.length` |
| "Redirect an old URL" | The merchant's redirect table (`GET /resolve`, handled in `src/middleware.ts`) | Hardcoded redirects |
| "Add a field to the address form" | It comes from `CheckoutSettings.addressForm` → "needs backend support" | `<input name="landmark">` of your own |
| "Only let pending orders be cancelled" | Nothing: show cancel only when `order.actions.canCancel` | `status.code === 'pending'`, date math on `placedAt` |
| "Make it look like brand X" | Tokens in `globals.css`, component CSS modules | Change what data is shown |

## Before you say "done"

```bash
npm run verify   # types → lint → rules → contract → unit/component tests → build → e2e
```

If a rule fails, the message says which rule and how to fix it. Don't disable a rule to get
green — fix the code. If the task truly needs something the API doesn't provide, stop and
report it instead.
