# Home page

Data: `GET /api/customer/v3/home` → `getHome(client, locale)` → type `Home` (see `contract/openapi.yaml`).
Loaded in `src/app/[locale]/page.tsx` with `loadHome(locale)`.

```ts
interface Home {
  promoBanners: PromoBanner[];     // merchant strips, identified by `placement` ("top-ad", "bottom-ad", ...)
  featuredCategories: Tile[];      // "Shop by category"
  sections: Section[];             // merchant-configured sections, IN THE MERCHANT'S ORDER
  featuredBrands: Tile[];          // brand logos
  popups: Popup[];                 // at most one is shown per page view (PopupHost)
}
```

## What the backend decides vs what you decide

| Backend (never change it) | You (free to change) |
|---|---|
| Which sections exist, their order, their titles (`title: null` = hidden) | Where each block sits on the page (page.tsx composition) |
| Which banners/products a section has | How many items are visible per row (`Rail perView`) |
| Section `layout` (the merchant's choice) | How each layout is drawn (`BannerLayouts.tsx`) |
| Every link (`target`, `viewAll`) | Link styling, labels like "View all" (i18n) |
| Prices and their texts, discount label, stock, `purchase.canAddToCart` | How they look (`className` / `classNames` on `<Price>`) |
| Popup `frequency` | How the popup looks |

## Sections

```ts
interface Section {
  id: number;
  title: string | null;          // null → no heading
  layout: SectionLayout;         // products_only | single_banner | banner_carousel | wide_banner | banner_grid | banner_rows
  design?: string | null;        // the merchant's pick from src/designs/sections.json (null → draw by layout)
  banners: Banner[];             // { id, image: {mobile, desktop, alt}, title, target }
  products: ProductCard[];
  viewAll: Target | null;        // only when the section has products
  blocks?: SectionBlocks | null; // merchant-built blocks; when non-empty they replace banners + products (see Blocks)
}
```

- The backend only returns sections that have something to show — don't add your own
  "is empty?" checks.
- Each layout is drawn by one entry in `bannerLayouts` (`src/components/home/sections/BannerLayouts.tsx`).
  To restyle a layout, change its component/CSS. To support a new layout added to the
  contract, add one entry. Unknown layouts are drawn as `banner_grid` (`normalizeLayout`).
- Images: `<ResponsiveImage image={banner.image} />` picks mobile/desktop artwork.

### Designs (`src/designs/sections.json`)

- The storefront owns the design list: `src/designs/sections.json` (`key`, `name_en`, `name_ar`,
  `needs: {products, banners_min, banners_max}`, `legacy_image_type`, optional `legacy_image_type_by_banners`
  — banner count → old image type, e.g. `{"2": 5, "3": 6, "4": 7}`). The backend stores it
  (`npm run designs:register` with `SC_API_URL` + `STOREFRONT_DESIGNS_KEY`) and the admin lets the merchant
  pick one per section; the section then comes with `design`.
- Today a design controls the **banner area only**: the section title and the product row are drawn the same
  for every design (`HomeSection.tsx`). `needs.products` means "this design can show the product row" (not
  "products are required"); `banners_min/max` are how many banners it draws (what the admin lets the merchant add).
- Each key is drawn by one entry in `sectionDesigns` (`BannerLayouts.tsx`). The first six keys are the layout
  names. A section whose `design` is null or not in `sectionDesigns` is drawn by its `layout`, as before.
- **New kind of section** → a new component + a new entry in `sectionDesigns` + a new entry in
  `sections.json`. **Change how a design looks** → its component/CSS. Never rename or remove a key
  (sections in the backend point at it). `src/designs/sections.test.ts` checks the file and that every key has
  a renderer.

### Blocks (`Section.blocks`; absent when the store has blocks switched off)

- A section may come with `blocks` (`{version: 1, blocks: [...]}`): a tree the merchant (or the AI editor) built —
  containers `slider` / `grid` / `row` holding leaves `image` / `text` / `button` / `product_list`, already resolved:
  image URLs (`media.desktop|mobile|desktop_ar|mobile_ar`), texts in the page's language, links as `target`
  (`null` = not clickable: draw it, but not as a link).
- Non-empty `blocks` → `HomeSection` draws the heading, then `<BlockRenderer>` **instead of** `banners` + `products`.
  `null` / missing / empty → today's path, unchanged.
- Each type is drawn by one component in `src/components/home/sections/blocks/` (`blockComponents` in
  `BlockRenderer.tsx`). Unknown types — and a container inside a container — are skipped. `product_list` shows the
  section's own `products` (at most `limit`) through `ProductCard` (prices: the money components).
- A design may restyle blocks: add its key to `blockDesigns` (`BlockRenderer.tsx`) with the block components it draws
  its own way; types it leaves out use the defaults.
- A slider with autoplay gets a visible pause/play button (Rail `autoplay` prop, labels `pauseSlides` / `playSlides`).
- Arabic pages use the `_ar` artwork when there is some (`blockImage` in `src/lib/blocks.ts`).
- Editor previews: env `SC_PREVIEW_TOKEN` (server-only) → the SDK sends `x-preview-token` and caches nothing; the
  backend then shows unpublished section drafts. Never set it on a live site.
- Fixture: `homeBlocksFixture()` (`scripts/build-home-blocks-fixture.mjs`). Tests: `blocks/BlockRenderer.test.tsx`,
  `HomeSection.test.tsx`.

## Product card (`ProductCard.tsx`)

```ts
interface ProductCard {
  id, slug, name, image: {url, alt} | null,
  brand: { name, slug, target } | null,
  price: {                                                         // null = store hides prices
    display, compareAtDisplay, discountLabel,                      // texts to show: '176 EGP', '196 EGP', '10 %'
    currency, amount, compareAt, discountPercent,                  // numbers: never shown, never used for math
  } | null,
  inStock: boolean,
  badges: { kind: 'label'|'promotion'|'preorder'|'coming_soon', text, color }[],
  rating: { average, count } | null,
  requiresPrescription: boolean,
  purchase: { canAddToCart, minQuantity, maxQuantity },
  target,   // product page
}
```

- Render `<Price price={product.price} locale={locale} />` from `@/money`: the price, the old price
  struck through and the discount, exactly as the backend wrote them. The card shows the discount
  as a badge on the image with `<DiscountLabel price={product.price} />` and `showDiscount={false}`
  on `<Price>`. Style both with `className` / `classNames`. **No arithmetic, no formatting.**
- `price: null` → `<Price>` renders nothing (do not show 0).
- Badges with `text: null` get a translated label from i18n (`preorder`, `comingSoonBadge`).
- "Add to cart" / heart / compare buttons: enable from `purchase.canAddToCart`, write through a
  server action (`withShopper` → `setCartItem` / `addToWishlist` / `addToCompare`), and mark
  "in cart"/"in wishlist" from `getMe`. See [session.md](session.md), [cart.md](cart.md),
  [wishlist-compare.md](wishlist-compare.md).

## Promo banners

`promoFor(home, 'top-ad')` returns the strip for a placement or `null`. Placement keys are the
merchant's names (slugified, language-independent). Where each placement goes is your choice
(`PROMO_PLACEMENTS` in `src/lib/home.ts`).

## Popups

`PopupHost` shows the first popup allowed by its `frequency` (`always`, `once_per_session`,
`once_per_day`) using `pickPopup()` from `src/lib/popup.ts`. Remembering what the visitor saw
is the storefront's job (localStorage/sessionStorage, wrapped in try/catch).

## Recipes

- **Reorder home blocks** → edit JSX order in `src/app/[locale]/page.tsx`. Keep `home.sections`
  in the order given.
- **Hide a block** (e.g. brands) → remove the component from page.tsx. Never filter API data
  to hide merchant content selectively.
- **Change a layout's look** → `BannerLayouts.tsx` / `.module.css`.
- **New UI text** → `src/lib/i18n.ts` (`en` + `ar`), then `t('key')`.
- **Tests to update**: `HomeSection.test.tsx`, `ProductCard.test.tsx`, `e2e/home.spec.ts`.
