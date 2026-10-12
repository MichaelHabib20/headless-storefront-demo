# Listings, search, categories, brands and unknown paths

One product listing from the backend draws every listing page. The backend decides the heading,
the products, their order, the filters, the counts and every link. The storefront only draws.

## Routes

| URL | Page | Scope sent to `GET /products` |
|---|---|---|
These are the old storefront's URLs (backend `docs/headless/url-parity-plan.md`); keep them.

| `/{locale}/{slug}` | `[...slug]/page.tsx` → `_product/ProductPage.tsx` | the product (`GET /products/{slug}`); not a product → `GET /resolve` (a category, CMS page or brand slug moves there), else 404 |
| `/{locale}/product/{path...}` | `src/app/[locale]/product/[...path]/page.tsx` | `category=a/b/c` (the path joined with `/`); `/product/{cat}/brand/{b}` adds `brands=b`; `/product/deals/{cat}` → `deals=true` |
| `/{locale}/product/brand/{slug}` | `product/brand/[slug]/page.tsx` | `brand=slug` (`a--b`: several brands) |
| `/{locale}/products/list/{slug or id}[/{cat}]` | `products/list/[key]/[[...category]]/page.tsx` | `list=key` |
| `/{locale}/products/tag/{slug}` | `products/tag/[slug]/page.tsx` | `tag=slug` |
| `/{locale}/products/deals[/{name}]` | `products/deals/[[...name]]/page.tsx` | `deals=true` |
| `/{locale}/products?search=` (also `?q=`) | `products/page.tsx` (also `/product`) | `q=…` (search text); the old id parameters (`category_id`, `list_ids`, `brand_id`, `price_from`, …) pass through, the backend reads them, and filter links keep the scope ones |
| `/{locale}/all-products` | `all-products/page.tsx` | no scope: every product (the old storefront's page; the Target `{type: search, query: ""}` and the bottom nav's "All products" open it). Link with `routes.allProducts(locale)`, never an empty search (rule `all-products-route`) |
| `/{locale}/categories` | `categories/page.tsx` | `GET /categories` (the tree) |
| `/{locale}/category[/{cat}[/{group}]]`, `/category-view` | `category/[[...path]]/page.tsx`, `category-view/page.tsx` | `GET /categories`: the old category view at its own address (canonical to itself): a category's groups, a group's sub-categories, or every category; "View all" opens the `/product/...` listing; a path not in the tree is a 404 |
| `/{locale}/brands` | `brands/page.tsx` | `GET /brands?page=` (24 tiles a page) |
| anything else | `src/middleware.ts` + `[...slug]/page.tsx` | `GET /resolve?path=` |

Every listing route passes its scope **and all of the page's own query parameters, untouched** to
`<ListingPage>` (`src/components/catalog/ListingPage.tsx`), which loads through `loadListing()`
(`src/lib/catalog.server.ts`) and draws `<ListingView>`.

## Data

| SDK (`@/sdk`) | Endpoint | Notes |
|---|---|---|
| `getProducts(client, ctx, scope, params)` | `GET /products` | With the shopper's token (their prices). `params` go through as they are, repeated keys included; scope keys and `locale` only come from the route |
| `getSearchSuggestions(client, ctx, q, limit?)` | `GET /search/suggestions` | Used by the header search box through `searchSuggestionsAction` (a read-only server action) |
| `getCategories(client, locale)` | `GET /categories` | `{ items: CategoryNode[] }`, 3 levels |
| `getBrands(client, locale, { page, perPage })` | `GET /brands` | Tiles + pagination |
| `resolvePath(client, locale, path)` | `GET /resolve` | Only the middleware calls it |

```ts
interface ProductListing {
  context: { type; title; description: RichText | null; image: Image | null; query: string | null };
  breadcrumbs: Link[];
  items: ProductCard[];
  pagination: { page; perPage; total; totalPages };
  sort: { label; selected; query }[];                 // exactly one selected
  facets: { key; label; kind: 'options' | 'range'; display: 'list' | 'color' | 'image';
            values: { label; selected; count; color; image; query }[];
            range: { min: Money | null; max: Money | null; selectedMin; selectedMax; query } | null }[];
  appliedFilters: { label; removeQuery }[];
  clearFiltersQuery: string | null;                    // null = no filter in use
  seo: Seo;
}
```

## How links work

Every sort option, filter value, chip and "clear all" carries a `query` string **written by the
backend**. The link is this page's path + that query: `listingHref(path, query, keep)` in
`src/lib/listing.ts`. On the search page `keep` is `{ q }`, so the search text stays.
Page links keep the current query and change only `page`: `listingPageHref()`.
The price range is a GET form (`next/form`): `priceMin` / `priceMax` inputs plus the parameters
of `range.query` as hidden fields (`formFields()`).

## What the storefront must not do

- Build, merge, parse or reorder filter parameters (`brands=`, `options=`, `sort=`…). Use the `query` strings.
- Decide which filters exist, hide values, compute counts, or sort products itself.
- Count results from `items.length` — the count is `pagination.total`.
- Format or compare prices (the range bounds are `<Money>`; products are `<ProductCard>` / `<Price>`).
- Write filters into the URL from JavaScript state. Everything is a link or a GET form, so it works without JavaScript.
- Build category/brand URLs from slugs. Links go through `<TargetLink>`; the scheme is `src/lib/routing.ts`.

## Unknown paths

`src/middleware.ts` runs before rendering, the way the old storefront's server did:
1. no `/en` or `/ar` → 301 to `/en` + the path;
2. the interim paths this storefront used before (`/p/x`, `/c/...`, `/sign-in`...) → 301 to the old URL (`interimRedirect()`);
3. `/orders/...` → shown as `/account/...` (the old guest-order alias);
4. one of our public pages (`isStorefrontPath()`) → `GET /resolve?only=redirects`: the merchant's
   redirect table may still move it (301/302) or mark it gone (410); answers are reused for a minute;
5. any other path → `GET /resolve` with its query and locale prefix. `answerForResolution()` (`src/lib/resolve.ts`) decides:

| `result` | Answer |
|---|---|
| `target` | 301 to our URL of the Target |
| `redirect` | 301/302 (`permanent`) to the Target, or else to `url` |
| `gone` | 410; the catch-all page draws "no longer available" (the middleware sets `x-storefront-resolution: gone`) |
| `not_found` / API down | 404 page |

It cannot loop: a destination on this site must be one of our routes and not the requested path;
only http(s) is followed. **A new route must be added to `routes`, its shape to `OWN_PATHS` and its
first segment to `RESERVED_SEGMENTS` in `routing.ts`** (a test fails otherwise; a reserved segment
can never be a product slug).

## Change the look

| Want | Where |
|---|---|
| Grid columns, card spacing | `.grid` in `src/components/catalog/Listing.module.css` |
| Sidebar width / drawer look | `.layout`, `.panel`, `.panelOpen` in the same file |
| Filter value look (checkbox, swatch, logo) | `ValueMark` in `ListingFilters.tsx` + `.check` / `.swatch` / `.valueImage` |
| Sort as pills instead of a menu | `SortMenu.tsx` (keep them links with `option.query`) |
| Suggestions popup | `src/components/layout/SearchBox.tsx` + `SearchBox.module.css` |
| When suggestions start | `MIN_CHARS` / `DELAY_MS` in `SearchBox.tsx` (the contract allows 1 character) |
| Category / brand index | `CategoryTree.tsx`, `BrandGrid.tsx`, `Catalog.module.css` |
| Texts | `src/lib/messages/catalog.ts` (`en` + `ar`) |

## Common requests

| Request | Do | Don't |
|---|---|---|
| "Add a 'price under 100' filter" | Needs backend support (a facet) | Add a link with `priceMax=100` yourself |
| "Hide the brand filter" | Style/skip by `facet.key` only if the merchant asks; better a backend setting | Drop facets by your own rules |
| "Show 24 products per page" | Store setting in the backend (`perPage` default) | Slice `items` |
| "Sort by newest" | Needs backend support (a sort option) | Sort `items` in the browser |
| "Show '12 products'" | `pagination.total` with `formatNumber()` | `items.length` |
| "Keep filters when switching category" | Needs backend support | Merge query strings |
| "Filter chips with an ×" | Already `AppliedFilters.tsx` (`removeQuery`) | Rebuild the query without that value |
| "Redirect old URLs" | The merchant's redirect table → `/resolve` | Hardcode redirects in `next.config` or the middleware |
| "Colour swatches" | `display: 'color'` + `value.color` (checked by `swatchColor()`) | Map labels to colours |

## Tests

- Unit: `src/sdk/v3/catalog.test.ts`, `src/lib/listing.test.ts`, `src/lib/resolve.test.ts`,
  `src/lib/catalog.actions.test.ts`, `routing.test.ts` (every route is ours).
- Components: `ListingView.test.tsx`, `ListingPage.test.tsx`, `CatalogIndexes.test.tsx`,
  `SearchBox.test.tsx`, `[...slug]/page.test.tsx` with `productsFixture`, `emptyProductsFixture`,
  `suggestionsFixture`, `categoriesFixture`, `brandsFixture` (`en` + `ar`).
- Mock: `scripts/mock/catalog.mjs` (every `query` string comes from one helper, `queryOf()`),
  checked by `scripts/mock-catalog.test.mjs`. Fixtures: `node scripts/build-catalog-fixtures.mjs`.
- E2E: `e2e/catalog.spec.ts` — filters, sort, pages, price form, search + suggestions, every
  route, 404/invalid, Arabic, phone drawer, no-JavaScript filters, and the 301/302/410/404 answers.

### Mock states

| State | How |
|---|---|
| Categories | The recorded menu's tree; products in `mom-baby/baby-care/baby-toiletries-bath-accessories`, `every-day-essentials/body-fresheners/body-cologne`, `hair-care` |
| Brands | `johnson-johnson` (10 products), `bioderma` and the other featured brands (empty) |
| List / tag / deals | `/products/list/125`, `/products/list/best-sellers`, `/products/tag/new-arrivals`, `/products/deals` (3 products with an old price) |
| Search | By name or brand; `q=zzzz` → no results |
| Pages | 8 per page (`perPage` up to 48) |
| Invalid | `priceMin=abc`, `page=0` → 422 |
| Resolve | `/en/product/36480/…` → target; `/en/summer-sale` → 302 deals; `/en/blog` → 301 external; `/en/discontinued-offer` → gone; `/en/self-redirect`, `/en/unsafe-redirect` → broken rows (404) |
