# Product page

Route: `/{locale}/{slug}` (the old storefront's URL, `routes.product`), drawn by `src/app/[locale]/[...slug]/page.tsx` with `src/app/[locale]/_product/ProductPage.tsx`. The backend picks the
variant, prices it, decides every option's state and where each option value leads. The page draws.

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `GET /products/{slug}` | `getProduct(client, ctx, slug)` | Read with `shopperContext` (token optional: prices and limits are the shopper's). 404 → not-found page |
| `GET /products/{slug}/recommendations` | `getProductRecommendations(client, ctx, slug)` | Rows in the order to show them |
| `GET /products/{slug}/reviews?page&perPage` | `getProductReviews(client, locale, slug, { page, perPage })` | Public. `enabled: false` → show nothing |
| `POST /products/{productId}/notify-me` `{email?}` | `notifyWhenAvailable(client, ctx, productId, email?)` | Server action with `withShopper`. 422 `fields.email`, 409 `already_available` |

```ts
interface ProductDetails {
  product: ProductCard;              // the variant shown; its id is the one for cart / wishlist / compare
  redirect: ProductTarget | null;    // set → redirect permanently there (e.g. English slug on /ar)
  sku: string | null;                // null = the store hides it
  gallery: Image[];                  // main image first
  video: { url, thumbnail } | null;
  options: { id, name, display: 'buttons'|'dropdown'|'color'|'image', values: {
    id, label, color, image, state: 'selected'|'available'|'out_of_stock'|'unavailable', target: ProductTarget | null }[] }[];
  availability: { status, message: string | null, notifyMe: boolean };
  quantityStep: number;
  breadcrumbs: Link[]; summary: RichText | null; description: RichText | null;
  specifications: { name, value }[]; notices: { kind: 'promotion'|'payment_offer'|'info', text }[];
  seo: Seo;
}
```

## Where things are

| Path | What |
|---|---|
| `src/app/[locale]/_product/ProductPage.tsx` | Loads the product (once per request, shared with `generateMetadata`), redirect / 404 / API down |
| `src/app/[locale]/_product/blocks.tsx` | `RecommendationsBlock`, `ReviewsBlock`: load on their own inside `<Suspense>`; a failure never breaks the page |
| `src/app/[locale]/_product/actions.ts` | `notifyMeAction` (server action, `withShopper`) |
| `src/components/product/ProductView.tsx` | Page layout: gallery, info column, description, specifications, slots for the blocks |
| `ProductGallery.tsx` | Thumbnails (click, arrow keys, Home/End), video slide (opens `video.url` in a new tab) |
| `ProductOptions.tsx` | Option values as `<TargetLink>`s, drawn by `display` and `state` |
| `ProductActions.tsx` (`quantity` prop) | Quantity stepper + add / update cart, wishlist, compare — the same component as the cards |
| `NotifyMe.tsx`, `ProductReviews.tsx`, `ProductRecommendations.tsx`, `Stars.tsx`, `details.ts` | The other parts and display helpers |
| `scripts/mock/product.mjs` | Mock module with every state (see its header) |

## What the backend decides vs what you decide

| Backend (draw as it is) | You (free to change) |
|---|---|
| Which variant is shown, and which product each option value opens (`target`) | How values look per `display` hint (chips, swatches, pictures, a dropdown list) |
| Each value's `state` (selected / out of stock / unavailable) | How a state looks (dashed, struck through, faded) |
| Price, old price, discount (`<Price>`, `<DiscountLabel>`) | Where they sit, colors, size |
| Stock text (`availability.message`), `canAddToCart`, `notifyMe` | Message styling (the `status` may pick a color) |
| Quantity limits (`purchase.minQuantity`/`maxQuantity`, `quantityStep`) | Stepper look |
| When an email is needed for notify-me (422), "already in stock" (409) | Form layout |
| Rating average, review counts, star distribution `percent`, pages | Stars, bars (width = `percent`), list layout |
| Recommendation rows, titles, order, the bought-together `total` (`<Money>`) | Rail size, cards per row |
| `seo` (title, description, canonical, alternates, index) | — (use `seoMetadata()`) |

## Rules

1. **Options are links.** Render each value with `<TargetLink target={value.target}>`. Never work out
   which variant matches a combination, never build product URLs from option values, never enable a value
   with `state: 'unavailable'` or a `null` target. Unknown `display` → buttons (`optionLook()`).
2. **Redirect when told.** `details.redirect` set → `permanentRedirect(resolveTarget(redirect).href)`.
3. **Buy box:** reuse `ProductActions` with `quantity={{ limits: quantityLimits(details), labels }}`.
   The button sets the cart line to the chosen quantity (`PUT /cart/items/{id}`); enabled only by
   `purchase.canAddToCart`. Never invent limits.
4. **Notify-me:** show only when `availability.notifyMe`. Send the email only when the shopper typed
   one; show the email field when the backend asks (422 `fields.email`). Show 409 `already_available`
   as its message.
5. **Recommendations and reviews never block or break the page**: separate async server components
   inside `<Suspense>`, failures caught.
6. Formatted text (`summary`, `description`) only through `<RichText>`; money only through `@/money`.
7. `option.display` is a drawing hint, not money: the `money-via-components` rule allows exactly
   `option.display` (any other `.display` is still money).

## Common requests

| Request | Do | Don't |
|---|---|---|
| "Show sizes as a dropdown" | Change how `ProductOptions` draws that look, or map the hint in `optionLook()` | A `<select>` that builds URLs from labels |
| "Pick the cheapest variant by default" | Backend decision → "needs backend support" | Sort variants in the page |
| "Grey out sizes out of stock" | Style `.out_of_stock` in `ProductOptions.module.css` | Decide stock from `inStock` of other cards |
| "Show 'Only 3 left' in red" | Style `.availability[data-status=…]` | Compute it from a stock number |
| "Show 'You save 20 EGP'" | Only with a backend field → "needs backend support" | `compareAt - amount` |
| "Buy all bought-together items" | No bulk endpoint → "needs backend support" | Chain add-to-cart calls |
| "Max 10 per order" | Backend `purchase.maxQuantity` | Hardcode 10 |
| "Play the video inline" | Needs the backend to say what `video.url` is (file or player page) | Guess from the URL |
| "More reviews per page" | `REVIEWS_PER_PAGE` in `blocks.tsx` (1–50) | Slice `items` |

## Tests to update

- Components: fixtures from `@/test/product-fixtures` (`productFixture`, `outOfStockProductFixture`,
  `discountedProductFixture`, `galleryProductFixture`, `recommendationsFixture`, `reviewsFixture`,
  `reviewsDisabledFixture`, `en` + `ar`), generated by `node scripts/build-product-fixtures.mjs`.
- Mock: `scripts/mock-product.test.mjs` (every answer vs the contract).
- E2E: `e2e/product.spec.ts`. `POST /api/customer/v3/__mock/products/{id}/restock` makes an
  out-of-stock product available (for the 409 path).

## SKILL.md rows

| Task | Read |
|---|---|
| Product page, options, gallery, notify-me, reviews, recommendations | [reference/product.md](reference/product.md) |
