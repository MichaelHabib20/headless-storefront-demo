# SEO: meta, JSON-LD, robots.txt, sitemaps

The backend decides every SEO fact: titles, descriptions, canonical pages, languages, what may be
indexed, the breadcrumb trail, the schema.org facts of each page and of the store. The storefront
turns Targets into its own URLs (under the origin of the request) and writes the tags. It never
adds a fact of its own.

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Seo.title / description / canonical / alternates / index` (every page with a `seo`) | `<title>` (the whole title: no "\| store" added), meta description, `<link rel=canonical>`, hreflang, `robots: noindex` | `seoMetadata(seo, locale)` in `src/lib/seo.ts`, from each page's `generateMetadata` |
| `Seo.openGraph` | `og:title/description/image/url/locale/type`, Twitter card (null members fall back to title / description) | `seoMetadata` |
| `Seo.openGraph.type = product` | `<meta property="og:type" content="product">` (Next.js cannot write it) | `SeoLinks` in `src/lib/seo.ts` (rendered by `<JsonLd>`) |
| `Seo.pagination.prev/next` | `<link rel="prev|next">` = canonical page + `page` | `paginationHrefs` / `SeoLinks` |
| `Seo.structuredData.product` | Product (`@type` = `schemaType`, e.g. `Drug`) + Offer (only when `price` is not null) + AggregateRating (only when `rating`) | `productNode` in `src/lib/jsonld.ts` |
| `Seo.structuredData.collection` | CollectionPage + ItemList | `collectionNode` |
| `Seo.structuredData.webPage` | WebPage / ContactPage / AboutPage… (+ `about`) | `webPageNode` |
| `Seo.breadcrumbs` (home first, last not a link) | BreadcrumbList | `breadcrumbList` |
| `GET /seo/site` → `organization`, `localBusiness`, `website` | Organization, LocalBusiness (when not null), WebSite + SearchAction — on every page | `<SiteJsonLd>` in `src/app/[locale]/layout.tsx` |
| `GET /seo/site` → `verification.google` | `google-site-verification` meta (home) | `src/app/[locale]/page.tsx` `generateMetadata` |
| `GET /seo/site` → `robots.index` | `robots.txt`: `Disallow: /` when false; sitemap index empty | `src/app/robots.ts`, `src/app/sitemap.xml/route.ts` |
| `GET /sitemap?type=&page=&perPage=` | `/sitemap.xml` (index) → `/sitemaps/<type>-<locale>-<page>.xml` (1000 URLs each, `xhtml:link` alternates, `lastmod`) | `src/lib/sitemap.ts` + the two route handlers |
| `Layout.store.favicon` | `icons` in the layout metadata (already) | `src/app/[locale]/layout.tsx` |
| `Layout.store.favicon` | `/favicon.ico` → 302 to it (404 when none), like the legacy server | `src/app/favicon.ico/route.ts` |

`metadataBase` is the request origin (`requestMetadataBase()`), so canonical, hreflang and `og:url`
are absolute without a hardcoded host. JSON-LD URLs use `requestOrigin(headers())`
(`x-forwarded-host` / `host`, `x-forwarded-proto`).

Private pages are the storefront's own list (`PRIVATE_SECTIONS` in `src/lib/routing.ts`: cart,
checkout, account, sign-in, sign-up, wishlist, compare, notifications, the auth flows — forgot / reset
password, verify phone / e-mail, waiting approval — and track-order): `Disallow` in robots.txt and
`X-Robots-Tag: noindex` from `src/middleware.ts`.

## Recipes

- **A new page with a backend `Seo`** (CMS page, landing page, form): in its `generateMetadata`
  return `seoMetadata(page.seo, locale)`, and render `<JsonLd seo={page.seo} locale={locale} />`
  (from `@/lib/jsonld`) once in the page. That's all: JSON-LD, rel=prev/next and og:type follow.
- **A contact page**: the backend sends `webPage.schemaType = ContactPage`; the store's contact
  facts are already in the site-wide Organization block.
- **"Add a schema.org field" (e.g. `gtin`, `foundingDate`)**: if the backend sends it, map it in
  the matching `…Node` function of `src/lib/jsonld.ts`; if not → "needs backend support".
- **"Noindex this page"**: the backend's `Seo.index`. Only the shopper's private pages are ours.

## Don't

- Write `application/ld+json` anywhere but `src/lib/jsonld.ts` (rule `jsonld-one-place`).
- Invent a fact (a rating, a price, an availability, an address) or a default for a null one.
- Hardcode the store's host or build URLs from slugs: Targets go through `resolveTarget()`.
- Add "| Store name" to a backend title (the backend already decided it).

## Tests to update

`src/lib/jsonld.test.ts`, `src/lib/seo.test.ts`, `src/lib/sitemap.test.ts`, the route tests next to
`src/app/robots.ts`, `src/app/sitemap.xml/route.ts`, `src/app/sitemaps/[name]/route.ts`, `src/app/favicon.ico/route.ts`, `scripts/mock-seo.test.mjs`
(the mock: `scripts/mock/seo.mjs`, `scripts/mock/seo-extras.mjs`), fixtures
`node scripts/build-seo-fixtures.mjs`, e2e `e2e/seo.spec.ts`.
