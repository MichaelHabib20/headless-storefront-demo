# Site shell: mini cart, bottom nav, banners, area, store status, maintenance

Wired in `src/app/[locale]/layout.tsx` (the shell owns its structure; the SEO area adds its
`<MarketingTags>` / JSON-LD where the comment says). Every block renders nothing when its `Layout`
field is null or missing.

## Data → UI

| API | Component | Notes |
|---|---|---|
| `GET /cart` (server action `readMiniCart`) | `MiniCartProvider` / drawer (`MiniCart.tsx`) | Opened by `useMiniCart().open()` after a successful add to cart (`ProductActions`). Shows lines, `summary`, `checkout.blockers`; the checkout button is a link only when `checkout.allowed`. Reading never creates a guest (no token → "empty") |
| `Layout.mobileNav` | `MobileBottomNav` + "more" sheet | Items, order, labels, icons, badges are the API's. `navAction()` (`src/lib/mobile-nav.ts`): the item's Target, else our own page by id (`cart`, `categories`, `wishlist`, `compare`, `orders`, `notifications`, `account`), or an action (`more`, `area`, `language`); unknown ids are skipped. Badges: `navBadge()` from `Me.counts`. Phones only (CSS, < 768 px) |
| `Layout.appBanner` | `AppBanner` | Merchant title / text + store links; dismissal → cookie `sc_app_banner` (the server leaves it out next time) |
| `Layout.topBanner` | `TopBanner` | Above everything; `TargetLink` |
| `Layout.floatingBanner` | `FloatingBanner` | Bottom start, above the bottom nav; closing stores its id in `sc_floating_banner` (a new ad shows again) |
| `Layout.areaSelection` + `Me.area` + `GET /locations` | `AreaChooser` ("Deliver to …" strip + dialog) | Saved with `chooseAreaAction` → `PUT /me/area` (422 → the API message in the dialog). Opens by itself only when `required`, the visitor **has a session** and `Me.area` is null (`areaChooserForced`) |
| `Layout.storeStatus` | `StoreClosedNotice` | Only when `acceptingOrders` is false (no backend rule yet: always open today) |
| 503 `store_unavailable` on `GET /layout` | `StoreUnavailable maintenance={error.message}` | The SDK error kind `store_unavailable`; the message is the merchant's |
| `Layout.legal` | `LegalLinks` (footer), `CookieConsent` "Learn more" | See [content.md](content.md) |
| — | `UspStrip` | Storefront content (no merchant data exists): texts in `src/lib/messages/shell.ts` |

## Layout on phones

`body.has-bottom-nav` (set by the layout when `mobileNav` has items) reserves
`--bottom-nav-space` at the bottom and sets `scroll-padding-block-end`, so the cookie notice,
WhatsApp button and floating banner sit above the bar and focused elements never hide under it.
Drawers and dialogs (`MiniCart` z 80, area 90, more sheet 70) are above the bar (z 50).

## Rules

- Never build a nav item list (checker rule `mobile-nav-from-api`): add / remove / reorder items is
  a store setting (`BOTTOM_SHEET_CONFIGURATIONS` in the admin) → "needs backend / admin support".
- Never compute the mini cart's totals or "can check out": show `summary` / `checkout` as they are.
- Never create a guest to show the area chooser; the first save creates the session (a write).
- The maintenance message and the area prompt come from the API.

## Recipes

- **"Add a bottom nav item"** → it's `Layout.mobileNav`: the merchant configures it (admin) — report
  "needs backend / admin support". Restyle it in `MobileBottomNav.module.css`.
- **"Show a maintenance page"** → nothing to build: the API answers 503 `store_unavailable` and the
  layout shows `StoreUnavailable` with the merchant's message.
- **"Open the cart drawer from the header icon"** → call `useMiniCart().open()` from a client button.
- **"Change the USP texts"** → `src/lib/messages/shell.ts` (`usp*`, EN + AR).

## Tests to update

`src/components/layout/Shell.test.tsx`, `src/lib/mobile-nav.test.ts`, `src/lib/shell.actions.test.ts`,
`scripts/mock-content.test.mjs` (shell module), `e2e/shell.spec.ts`. Mock modes: `POST /__mode`
`{"multiInventory": true}`, `{"maintenance": true}`, `{"banners": true}`, `{"storeClosed": true}`.
