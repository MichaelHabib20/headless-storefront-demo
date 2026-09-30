# Wishlist and compare

Two personal product lists. Both return the same `ListState` after every add/remove. Session
rules: [session.md](session.md). Entry points are gated by `layout.features.wishlist` / `.compare`.

## Data

| Endpoint | SDK (`@/sdk`) | Returns |
|---|---|---|
| `GET /wishlist?page&perPage` | `getWishlist(client, ctx, { page, perPage })` | `{ items: ProductCard[], pagination }`, newest first |
| `PUT /wishlist/items/{productId}` | `addToWishlist(client, ctx, id)` | `ListState` (idempotent) |
| `DELETE /wishlist/items/{productId}` | `removeFromWishlist(client, ctx, id)` | `ListState` (idempotent) |
| `POST /wishlist/items/{productId}/move-to-cart` | `moveWishlistItemToCart(client, ctx, id)` | `{ cart: Cart, wishlist: ListState }` — one unit to the cart, removed from the wishlist |
| `GET /compare` | `getCompare(client, ctx)` | `{ products: ProductCard[], attributes, maxItems }` |
| `PUT /compare/items/{productId}` | `addToCompare(client, ctx, id)` | `ListState`; **409 `compare_full`** at the maximum |
| `DELETE /compare/items/{productId}` | `removeFromCompare(client, ctx, id)` | `ListState` (idempotent) |

```ts
interface ListState { count: number; productIds: number[]; maxItems: number | null }  // null = no limit
interface Pagination { page: number; perPage: number; total: number; totalPages: number }
interface CompareData {
  products: ProductCard[];
  attributes: { name: string; values: (string | null)[] }[];  // values[i] belongs to products[i]; null = no value
  maxItems: number | null;
}
```

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| Which products are listed, their order (newest first) | Grid / table / cards, columns per row |
| Page size limits (`perPage` 1–50) and `pagination` | The `perPage` you ask for, pager style |
| Compare maximum (`maxItems`) and `compare_full` | How "full" is shown |
| Comparison rows (`attributes`), their names and values | Table styling, sticky headers, horizontal scroll |
| Prices, stock, `purchase.canAddToCart` on each card | Card look (reuse `ProductCard`) |
| What "move to cart" does (quantity, removal) | The button and where it sits |

## Rules

1. **Compare max comes from `maxItems`.** Never hardcode 4 (or any number). `null` = no limit. Adding
   past the limit returns 409 `compare_full`: show `error.message`. You may disable "Add to compare"
   when `count >= maxItems` from the latest `ListState` — that's display, the backend still decides.
2. **Attributes are aligned by index.** `attributes[r].values[i]` belongs to `products[i]`. Render
   `null` as an empty cell/dash; never drop, sort or merge rows.
3. **Hearts / "in compare" marks** come from `me.wishlistProductIds` / `me.compareProductIds`, or
   the `productIds` of the last `ListState`. Never keep your own list in `localStorage`.
4. **Move to cart is one call.** Use `moveWishlistItemToCart`; don't chain add-to-cart + remove.
   Render the returned `cart` and `wishlist` states.
5. **Pagination comes from `pagination`.** Prev/next from `page` and `totalPages`; don't count items.
6. **Writes are server actions** (`withShopper` → SDK → `revalidatePath('/[locale]', 'layout')`)
   so the header counts update. Reads use `shopperContext`; no token → empty state, no call.
7. **No prices math** on the cards — same rules as the product card ([home.md](home.md)).

## Recipes

- **"Limit compare to 3"** → the limit is the backend's (`maxItems`); report "needs backend setting".
- **"Show 'Compare (2/4)'"** → `count` and `maxItems` from `ListState` / `CompareData`.
- **"Highlight differences in the compare table"** → OK as pure display (compare the value strings
  of a row); never infer values that are `null`.
- **"Add all wishlist items to cart"** → no bulk endpoint → "needs backend support".
- **New UI text** → `src/lib/messages/wishlist.ts` / `compare.ts` (`en` + `ar`).

## Tests to update

- Components: `wishlistFixture(locale)` (page 1 of 2, `perPage` 2) and `compareFixture(locale)`
  (2 products, 3 attribute rows with a `null` value, `maxItems` 4) from `@/test/fixtures`, `en` + `ar`.
- E2E: `e2e/wishlist.spec.ts`, `e2e/compare.spec.ts` against the mock (compare max 4 → 5th add is 409).
