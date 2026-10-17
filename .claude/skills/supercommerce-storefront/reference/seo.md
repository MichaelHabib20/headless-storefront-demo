# SEO: meta, JSON-LD, robots.txt, sitemaps

The backend decides every SEO fact: titles, descriptions, canonical pages, languages, what may be
indexed, the breadcrumb trail, the schema.org facts of each page and of the store. The storefront
turns Targets into its own URLs (under the public origin, see below) and writes the tags. It never
adds a fact of its own.

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Seo.title / description / canonical / alternates / index` (every page with a `seo`) | `<title>` (the whole title: no "\| store" added; content pages: see below), meta description, `<link rel=canonical>`, hreflang, `robots: noindex` | `seoMetadata(seo, locale)` in `src/lib/seo.ts`, from each page's `generateMetadata` |
| `Seo.openGraph` | `og:title/description/image/url/locale/type`, Twitter card (null members fall back to title / description) | `seoMetadata` |
| `Seo.openGraph.type = product` | `<meta property="og:type" content="product">` (Next.js cannot write it) | `SeoLinks` in `src/lib/seo.ts` (rendered by `<JsonLd>`) |
| `Seo.pagination.prev/next` | `<link rel="prev|next">` = canonical page + `page` | `paginationHrefs` / `SeoLinks` |
| `Seo.structuredData.product` | Product (`@type` = `schemaType`, e.g. `Drug`) + Offer (only when `price` is not null) + AggregateRating (only when `rating`) | `productNode` in `src/lib/jsonld.ts` |
| `Seo.structuredData.collection` | CollectionPage + ItemList | `collectionNode` |
| `Seo.structuredData.webPage` | WebPage / ContactPage / AboutPage… (+ `about`) | `webPageNode` |
| `Seo.breadcrumbs` (home first, last not a link) | BreadcrumbList | `breadcrumbList` |
| `GET /seo/site` → `organization`, `localBusiness`, `website` | Organization, LocalBusiness (when not null), WebSite + SearchAction — on every page | `<SiteJsonLd>` in `src/app/[locale]/layout.tsx` |
| `GET /seo/site` → `verification.google` | `google-site-verification` meta (home) | `src/app/[locale]/page.tsx` `generateMetadata` |
| `GET /seo/site` → `robots.index` | `robots.txt`: `Disallow: /` when false (non-production backend, DISABLE_SEARCH_ENGINE_INDEXING, store off) | `src/app/robots.txt/route.ts`, `src/lib/robots.ts` |
| `GET /sitemap?type=&page=&perPage=` | `/sitemap_index.xml` (also `/sitemap.xml`) → `/sitemap_<type>_<locale>[_<n>].xml`: the old storefront's files (`static_pages, pages, products, categories, subcategories, groups`, + `brands` / `landing_pages` / `tags` when not empty), Arabic first, 50,000 URLs per file (`_1`, `_2`... after the first), `xhtml:link` alternates + x-default, `lastmod`. An entry with `categoryView` is written at `/category/...` (`resolveCategoryView`). Always filled: robots.txt is what keeps crawlers out | `src/lib/sitemap.ts` + the two route handlers |
| `Layout.store.favicon` | `icons` in the layout metadata (already) | `src/app/[locale]/layout.tsx` |
| `Layout.store.favicon` | `/favicon.ico` → 302 to it (404 when none), like the legacy server | `src/app/favicon.ico/route.ts` |

**Public origin** (`src/lib/origin.ts`): `SC_SITE_URL` (per deployment: the store's canonical address,
e.g. `https://seif-online.com`) when it is set, else the request origin (`x-forwarded-host` / `host`,
`x-forwarded-proto`). `metadataBase` (`requestMetadataBase()`), JSON-LD, rel=prev/next, sitemaps and the
robots.txt `Sitemap:` line all use it, so canonical, hreflang and `og:url` are absolute without a
hardcoded host. With `SC_SITE_URL` set, any other host of the deployment (`*.vercel.app`, previews) is a
**test host**: robots.txt is `Disallow: /` and every page answers `X-Robots-Tag: noindex` (middleware).

**robots.txt** in order: test host → `Disallow: /`; backend `robots.index` false → `Disallow: /`;
`ROBOTS_TXT` (the deployment's own file, as it is); else the old storefront's rules (`defaultRobotsTxt`).

**`X-Robots-Tag: noindex, nofollow`** (`shouldNoindex` in `src/lib/indexing.server.ts`, from the
middleware) follows the same policy: private pages; every page of a test host; every page when the
backend's `robots.index` is false — with or without `SC_SITE_URL` (the seif test host on Vercel has
none). Production host + backend allows indexing → no header. The backend's answer is reused for
`SC_REVALIDATE_SECONDS`; when it cannot be reached pages stay indexable (like robots.txt).

**Canonical + hreflang on every page:** pages with a backend `Seo` use `seoMetadata`; our own indexes
(brands, categories, all-categories, vendors) use `ownPageAlternates(routes.x, locale)`: itself, both
languages, x-default Arabic. The layout sets **no** `alternates` (pages would inherit the home page's).

Private pages are the storefront's own list (`PRIVATE_SECTIONS` in `src/lib/routing.ts`: cart,
checkout, account, sign-in, sign-up, wishlist, compare, notifications, the auth flows — forgot / reset
password, verify phone / e-mail, waiting approval — and track-order): `Disallow` in robots.txt and
`X-Robots-Tag: noindex` from `src/middleware.ts`.

## Recipes

- **A new page of ours without a backend `Seo`** (an index): `alternates: ownPageAlternates(routes.x, locale)` in its
  `generateMetadata`.
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
- Add "| Store name" to a backend title (the backend already decided it). The one exception is the
  old storefront's content-page rule, in one place: `contentPageSeo(seo, page.title, store.name)`
  (CMS pages, contact, branches, forms) writes "<page> - <store>" only when the backend's title is the
  page name (no merchant SEO title). Our own pages get "<page> - <store>" from the layout's
  `titleTemplate`.

## Tests to update

`src/lib/jsonld.test.ts`, `src/lib/seo.test.ts`, `src/lib/sitemap.test.ts`, `src/lib/origin.test.ts`,
`src/app/[locale]/index-pages-metadata.test.ts`, the route tests next to `src/app/robots.txt/route.ts`, `src/app/sitemap.xml/route.ts`, `src/app/sitemaps/[name]/route.ts`, `src/app/favicon.ico/route.ts`, `scripts/mock-seo.test.mjs`
(the mock: `scripts/mock/seo.mjs`, `scripts/mock/seo-extras.mjs`), fixtures
`node scripts/build-seo-fixtures.mjs`, e2e `e2e/seo.spec.ts` (a second server with `SC_SITE_URL` runs on `E2E_SITE_PORT`, default `E2E_PORT`+1: asked with
`x-forwarded-host` = its host it is production, as 127.0.0.1 a test host).
