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
| Prices, discount %, stock, `purchase.canAddToCart` | How they look |
| Popup `frequency` | How the popup looks |

## Sections

```ts
interface Section {
  id: number;
  title: string | null;          // null → no heading
  layout: SectionLayout;         // products_only | single_banner | banner_carousel | wide_banner | banner_grid | banner_rows
  banners: Banner[];             // { id, image: {mobile, desktop, alt}, title, target }
  products: ProductCard[];
  viewAll: Target | null;        // only when the section has products
}
```

- The backend only returns sections that have something to show — don't add your own
  "is empty?" checks.
- Each layout is drawn by one entry in `bannerLayouts` (`src/components/home/sections/BannerLayouts.tsx`).
  To restyle a layout, change its component/CSS. To support a new layout added to the
  contract, add one entry. Unknown layouts are drawn as `banner_grid` (`normalizeLayout`).
- Images: `<ResponsiveImage image={banner.image} />` picks mobile/desktop artwork.

## Product card (`ProductCard.tsx`)

```ts
interface ProductCard {
  id, slug, name, image: {url, alt} | null,
  brand: { name, slug, target } | null,
  price: { currency, amount, compareAt, discountPercent } | null,   // null = store hides prices
  inStock: boolean,
  badges: { kind: 'label'|'promotion'|'preorder'|'coming_soon', text, color }[],
  rating: { average, count } | null,
  requiresPrescription: boolean,
  purchase: { canAddToCart, minQuantity, maxQuantity },
  target,   // product page
}
```

- Show `price.amount` (what the shopper pays). If `compareAt` is set, show it struck through and
  `discountPercent` as the discount. Use `formatPrice(price, locale)`. **No arithmetic.**
- `price: null` → show no price (do not show 0).
- Badges with `text: null` get a translated label from i18n (`preorder`, `comingSoonBadge`).
- "Add to cart" / heart / compare buttons: enable from `purchase.canAddToCart`, write through a
  server action (`ensureShopperContext` → `setCartItem` / `addToWishlist` / `addToCompare`), and mark
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
