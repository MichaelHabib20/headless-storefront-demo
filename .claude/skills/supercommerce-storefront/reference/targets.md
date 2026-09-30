# Targets and URLs

Everything clickable the API returns carries a **Target**: *what* it points to, not a URL.

| `type` | Fields | Storefront URL (`src/lib/routing.ts`) |
|---|---|---|
| `product` | `slug` | `/{locale}/p/{slug}` |
| `category` | `path` (1–3 slugs: category → group/sub-category) | `/{locale}/c/{path...}` |
| `brand` | `slug` | `/{locale}/brands/{slug}` |
| `list` | `slug \| null`, `id \| null` | `/{locale}/lists/{slug or id}` |
| `page` | `slug` (CMS page) | `/{locale}/pages/{slug}` |
| `landing_page` | `slug` | `/{locale}/l/{slug}` |
| `form` | `slug` | `/{locale}/forms/{slug}` |
| `deals` | — | `/{locale}/deals` |
| `home` | — | `/{locale}` |
| `url` | `url` (external, absolute) | opens in a new tab with `rel="noopener noreferrer"` |

`null` target = not clickable.

## Rules

- Render links with `<TargetLink target={...} locale={locale}>`. It resolves the URL, handles
  external links safely and renders plain content for `null`/unknown targets.
- Need the URL as a string (e.g. for `router.push`)? `resolveTarget(target, locale)?.href`.
- **Never** `switch (target.type)` or build `/p/${slug}` outside `src/lib/routing.ts`
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
(`p, pages, l, forms, checkout, track-order`). Paths outside the storefront's routes are resolved
by the backend in `src/middleware.ts` (redirect, 410 or 404, see [catalog.md](catalog.md#unknown-paths)).
A new route also needs its first segment in `OWN_SECTIONS` in `routing.ts`. When you build a real page (e.g. `src/app/[locale]/p/[slug]/page.tsx`), it takes
precedence automatically; remove its segment from `PLANNED`.
