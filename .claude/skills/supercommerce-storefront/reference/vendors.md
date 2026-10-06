# Vendors: the sellers of a multi-vendor store (`/vendors`, `/vendors/{id}`)

A multi-vendor store sells for several sellers. The backend decides which vendors exist and in which order,
their names and images, which products each sells (the shopper's area included), and whether the home page
shows them. Design: backend `docs/headless/phase-b-v3-design.md` §3. Off on staging (`ENABLE_MULTI_VENDOR` off).

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.vendors` | Vendor entry points exist (the pages answer 404 without it) | `src/lib/mobile-nav.ts` (`vendors` item) |
| `GET /vendors` → `title`, `hint`, `items[]` (`Vendor`: `id`, `name`, `image`, `description`, `target`) | `/vendors`: a tile per vendor | `src/app/[locale]/vendors/page.tsx`, `BrandGrid` |
| `VendorTarget {type: vendor, id}` | `/vendors/{id}`: the vendor's products, the normal listing (filters, sort, pages) | `src/lib/routing.ts` (`resolveTarget`), `src/app/[locale]/vendors/[id]/page.tsx` |
| `GET /products?vendor={id}` → `ProductListing` with `context.type = vendor` | The listing page | `ListingPage` with `scope={{ vendor }}` |
| `Home.featuredVendors` (`title`, `items` Tile[]; absent = none) | The home vendors rail + "All vendors" | `src/components/home/VendorRail.tsx` |
| Banners / ads linking to a vendor | Their Target is a `VendorTarget` | `TargetLink` |

## Recipes

- **"Show the vendor on product cards"**: no vendor field on `ProductCard` → "needs backend support".
- **"Hide vendors on the home page"**: the merchant's setting (`DISABLE_VENDORS_FROM_HOME_PAGE`) → "needs backend support"; or move the block (`src/app/[locale]/page.tsx`).
- **"A slug in the vendor URL"**: vendors have no slug; the path is the Target's `id`.
- **Restyle**: `BrandRail.module.css` / `Catalog.module.css` (vendors reuse the brand tiles), or give vendors their own component.

## Not in v3 yet

The cart split by vendor and placing a multi-vendor order: the checkout answers the `not_supported` blocker
for such stores (the backend's decision). Do not build a per-vendor cart in the browser.

## Don't

- Filter or sort the vendor list, or build a vendor URL from anything but the Target.
- Send `vendor_ids` or any legacy parameter: the listing scope is `vendor`.

## Tests to update

`src/components/home/VendorRail.test.tsx`, `src/lib/routing.test.ts`, `src/sdk/v3/catalog.test.ts`, `scripts/mock-vendors.test.mjs`
(mock: `scripts/mock/vendors.mjs`, switches `POST /__mode {"vendors": {"on": true, "home": true}}`), e2e `e2e/vendors.spec.ts`.
