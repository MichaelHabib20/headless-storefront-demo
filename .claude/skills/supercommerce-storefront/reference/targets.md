# Targets and URLs

Everything clickable the API returns carries a **Target**: *what* it points to, not a URL.

The URLs are the **old storefront's URLs, unchanged** (backend `docs/headless/url-parity-plan.md`):
indexed pages, shared links and the links in e-mails keep working. Never change one without a
redirect plan.

| `type` | Fields | Storefront URL (`src/lib/routing.ts`) |
|---|---|---|
| `product` | `slug` | `/{locale}/{slug}` (a single segment at the root; Arabic slug on `/ar`) |
| `category` | `path` (1–3 slugs: category → group/sub-category; Arabic slugs on `/ar`, from the API) | `/{locale}/product/{path...}` |
| `brand` | `slug` (several joined with `--`) | `/{locale}/product/brand/{slug}` |
| `list` | `slug \| null`, `id \| null` | `/{locale}/products/list/{slug or id}` |
| `page` | `slug` (CMS page), `legal?` | `/{locale}/pages/{slug}`; a legal page at the root: `/privacy-policy`, `/terms-and-conditions`, `/cookie-policy` |
| `landing_page` | `slug` | `/{locale}/landing-page/{slug}` |
| `form` | `slug` | `/{locale}/forms/{slug}` |
| `tag` | `slug` | `/{locale}/products/tag/{slug}` |
| `search` | `query` | `/{locale}/products?search=…`; `""` → `/{locale}/all-products` |
| `deals` | — | `/{locale}/products/deals` |
| `home` | — | `/{locale}` |
| `url` | `url` (external, absolute) | opens in a new tab with `rel="noopener noreferrer"` |

Shopper pages keep the old paths too: `/favorites`, `/session/signin?returnUrl=`, `/session/signup`,
`/session/forgot-password`, `/session/change-password` (reset), `/session/verifyEmail`,
`/account/order-history[/{id}]` (also under `/orders/...`), `/account/address[/add|/edit/{id}]`,
`/account/change-password`, `/account/track-your-order`, `/checkout/final-receipt`.

`null` target = not clickable.

## Rules

- Render links with `<TargetLink target={...} locale={locale}>`. It resolves the URL, handles
  external links safely and renders plain content for `null`/unknown targets.
- Need the URL as a string (e.g. for `router.push`)? `resolveTarget(target, locale)?.href`.
- **Never** `switch (target.type)` or build `/${slug}` outside `src/lib/routing.ts`
  (the `links-via-routing` rule fails the build).
- New target types can appear in the contract later. `resolveTarget` returns `null` for types it
  doesn't know → rendered as plain content. To support one: add a `case` in `resolveTarget` and a
  route in `routes`, plus a test in `routing.test.ts`.

## Changing the URL scheme

The URL scheme belongs to the storefront. To change e.g. `/p/{slug}` to `/product/{slug}`:
1. Change `routes.product` in `src/lib/routing.ts`.
2. Add the first segment to `PLANNED` in `src/app/[locale]/[...slug]/page.tsx` (until the real page exists).
3. Update `routing.test.ts` and e2e expectations.

## Pages that don't exist yet

`src/app/[locale]/[...slug]/page.tsx` shows "Coming soon" for the planned first segments
(`pages, l, forms, track-order`). Paths outside the storefront's routes are resolved
by the backend in `src/middleware.ts` (redirect, 410 or 404, see [catalog.md](catalog.md#unknown-paths)).
A new route also needs its first segment in `OWN_SECTIONS` in `routing.ts`. When you build a real page (e.g. `src/app/[locale]/p/[slug]/page.tsx`), it takes
precedence automatically; remove its segment from `PLANNED`.
