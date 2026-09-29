---
name: supercommerce-storefront
description: Rules, APIs and components for changing this SuperCommerce headless storefront (Next.js). Use for ANY change to pages, components, styles, copy, links, data loading or tests in this repo — especially the home page, header, footer, sections and product cards.
---

# SuperCommerce storefront

This storefront is a client of the SuperCommerce **storefront API v3**. The backend owns
business logic (what to show, prices, links, rules). This repo owns the UI (how it looks).
Follow these rules even when a shortcut looks easier — `npm run verify` enforces most of
them and **blocks the deploy** when one is broken.

## The rules

1. **Only `src/sdk` talks to the backend.** Load data with SDK functions (`getLayout`,
   `getHome`) through `src/lib/storefront.server.ts`. Never `fetch`, never call
   `/api/customer/...`, never use legacy fields (`image_type`, `item_id`, `discount_price`,
   `name_ar`...). If the SDK has no function for what you need → stop and report
   "this needs backend support". Do not invent endpoints.
2. **Never compute business values.** Prices, discounts, totals, stock, "can add to cart",
   which sections exist and their order all come from the API. Display them with
   `formatPrice()`; never do arithmetic on `amount` / `compareAt` / `discountPercent`.
3. **Every link to backend content goes through the Target.** Render
   `<TargetLink target={x.target}>`. Never branch on `target.type`, never build URLs from
   slugs. The URL scheme lives in ONE file: `src/lib/routing.ts`.
4. **Content text comes translated from the API** (titles, menu labels). UI strings you add
   (buttons, headings, labels) go in `src/lib/i18n.ts` — **both** `en` and `ar`.
5. **Everything works in Arabic (RTL).** Use logical CSS (`margin-inline-start`,
   `inset-inline-end`, `padding-inline`), never `left`/`right`. Arrows use
   `<Icon directional />`.
6. **Unknown is skipped, not guessed.** New section layouts fall back to the grid
   (`normalizeLayout`); unknown target types render as plain content. Never crash on data.
7. **Secrets stay on the server.** No `process.env` in `'use client'` files. No hardcoded
   store URLs or hosts. No `dangerouslySetInnerHTML`.
8. **UI is yours.** Layout, spacing, colors, typography, component structure, copy — change
   freely. Theme tokens live in `src/app/globals.css`.
9. **Always finish with `npm run verify`** and fix every failure before you say you're done.
   Add or update tests for what you changed (see "Tests").

## Where things are

| Path | What |
|---|---|
| `contract/openapi.yaml` | The API contract (source of truth). Copied from the backend with `npm run contract:sync`. |
| `src/sdk/` | SDK: the only code that calls the API. `generated/api.ts` is generated — never edit it. |
| `src/lib/` | Logic layer: `routing.ts` (Target → URL), `i18n.ts` (UI strings), `format.ts` (price display), `home.ts`, `popup.ts`, `storefront.server.ts` (server data loading) |
| `src/components/ui/` | Building blocks: `TargetLink`, `ResponsiveImage`, `Rail`, `SectionHeading`, `Icon` |
| `src/components/layout/` | Site chrome: `AnnouncementBar`, `TopBar`, `SiteHeader`, `DesktopNav`, `MobileMenu`, `SiteFooter`, `CookieConsent`, `WhatsAppButton` |
| `src/components/home/` | Home blocks: `PromoStrip`, `CategoryTiles`, `BrandRail`, `PopupHost`, `sections/HomeSection` + `sections/BannerLayouts` |
| `src/components/product/ProductCard.tsx` | Product card |
| `src/app/[locale]/layout.tsx` | Loads `layout`, renders chrome for every page |
| `src/app/[locale]/page.tsx` | The home page: composition of home blocks |
| `src/app/[locale]/[...slug]/page.tsx` | "Coming soon" for routes that aren't built yet |
| `src/test/fixtures/v3/` | Real recorded API responses (`npm run fixtures:record`) |
| `scripts/` | `check-rules.mjs` (architecture rules), `contract-check.mjs`, `mock-api.mjs`, `record-fixtures.mjs` |

## Read before you change

| Task | Read |
|---|---|
| Anything on the home page (sections, banners, tiles, product rows, popups) | [reference/home.md](reference/home.md) |
| Header, top bar, menu, footer, softbar, WhatsApp, cookie notice | [reference/layout.md](reference/layout.md) |
| Links, URLs, new routes | [reference/targets.md](reference/targets.md) |
| What store settings exist and what the UI must do with them | [reference/layout.md#features](reference/layout.md) |
| Sign in / sign up | [reference/auth.md](reference/auth.md) |
| Tests and the verify pipeline | [reference/testing.md](reference/testing.md) |

## Common requests → how

| Request | Do | Don't |
|---|---|---|
| "Move brands above the sections" | Reorder blocks in `src/app/[locale]/page.tsx` | Filter/reorder `home.sections` (merchant order) |
| "Show 6 products per row" | `perView` on the `Rail` in `HomeSection.tsx` | Slice `section.products` to hide items |
| "Show the discount as a red badge" | Style `.discount` in `ProductCard.module.css` | Recompute `(compareAt - amount) / compareAt` |
| "Add a 'Free delivery' label on cards" | Only if a backend field says so — otherwise report "needs backend support" | Hardcode rules like `amount > 500` |
| "Add a new text/button" | Add the key to `en` **and** `ar` in `src/lib/i18n.ts` | Hardcode English |
| "Link the logo somewhere else" | `routes.*` in `src/lib/routing.ts` | Write `'/en/...'` strings |
| "Make it look like brand X" | Tokens in `globals.css`, component CSS modules | Change what data is shown |

## Before you say "done"

```bash
npm run verify   # types → lint → rules → contract → unit/component tests → build → e2e
```

If a rule fails, the message says which rule and how to fix it. Don't disable a rule to get
green — fix the code. If the task truly needs something the API doesn't provide, stop and
report it instead.
