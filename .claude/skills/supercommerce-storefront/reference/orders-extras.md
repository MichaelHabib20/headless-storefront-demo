# Orders extras: track an order, rate it, write a review, share a product

Pages: `/[locale]/account/track-your-order` (public), the order page `/[locale]/account/order-history/[id]` (rating, reviews
per line), the product page (review form, share button). Components in `src/components/account/`
(`OrderRating`, `RateOrderDialog`, `ItemReview`, `ReviewDialog`, `StarInput`, `TrackOrderForm`) and
`src/components/product/` (`WriteReview`, `ShareButton`); strings in `src/lib/messages/orders-extras.ts`.

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `GET /orders/track?number&phone` | `trackOrder(client, locale, number, phone)` | Public. `Order` when BOTH match; 404 otherwise (also while the store has tracking off) |
| `POST /orders/{id}/rate` | `rateOrder(client, ctx, id, input)` | Only while `order.actions.canRate`; answers the `Order` with `rating`; 409 `already_rated` / `cannot_rate` |
| `POST /reviews` | `writeReview(client, ctx, { productId, rating, comment, orderId })` | 201 `{ message }`; 403 `feature_disabled`, 422 (`fields.orderId` when the store wants a delivered order), 404 |
| `GET /products/{slug}/reviews` | `getProductReviews(client, locale, slug, page, token)` | Now carries `write` (send the shopper token so it says whether THIS shopper may write) |

```ts
interface Order {
  // …
  items: { …; productId: number | null }[];           // the variant, for item ratings and reviews
  actions: { canCancel; canReorder; canRate?: boolean; canReviewProducts?: boolean };
  rating?: { rating: 1..5; driverRating: 1..5 | null; feedback: string | null } | null;
  ratingForm?: { driverRating: 'hidden' | 'optional' | 'required'; items: boolean } | null;
  phone?: string | null;                               // masked, for the tracking page
}
interface ProductReviewsPage { …; write?: { enabled; requiresSignIn; requiresOrder; message: string | null } }
```

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| Whether an order can be rated now (`actions.canRate`) and which fields the dialog has (`ratingForm`) | The dialog's look, the star widget, where the panel sits |
| The rating the shopper gave (`rating`) | How stars and feedback are drawn |
| Whether the order's products can be reviewed (`actions.canReviewProducts`), for which lines (`productId` present) | Button placement, the review dialog |
| Whether a shopper may write a review on the product page (`write`), and its sentence (`write.message`) | Where the entry point sits in the reviews block |
| The thank-you text (`message`) and every refusal | Our own fallback texts for network failures |
| Which order a number + phone opens (tracking), the masked `phone` | The form's look; the inputs are a plain GET form |
| Whether the share button exists (`Layout.features.share`), tracking (`features.orderTracking`) | The share menu's networks and look (inside `ShareButton`) |

## Rules

1. **Rating / review switches only from the API** (`rating-rules-from-api` rule): show "rate" only when
   `order.actions.canRate` and `order.ratingForm`; draw the delivery stars from `ratingForm.driverRating`
   (`hidden` / `optional` / `required`) and the product rows only when `ratingForm.items`. Show "write a
   review" only from `reviews.write` (product page) or `order.actions.canReviewProducts` (order page).
   Never derive them from `status.code`, the date or the session.
2. **"Not now" sends `skip: true`** — the backend remembers the dismissal; Escape just closes.
3. **Tracking is a read.** The form submits with GET to `routes.trackOrder(locale)`; the page calls
   `loadTrackedOrder()`; no session is created, and the order is shown with `<OrderDetails>` WITHOUT
   actions (no `cancelAction` / `reorderAction` / `rateAction` → nothing to click).
4. **Reviews are moderated:** after a 201 show the backend's `message`; never add the review to the list.
5. **One share component** (`share-in-one-place` rule): `<ShareButton>` when `layout.features.share`.
   Web Share API where available, else WhatsApp / Facebook / X / copy. Nothing about the product is
   decided there; the URL is the page's own.
6. **Writes are server actions** (`rateOrderAction` in `account/order-history/actions.ts`, `writeReviewAction`
   in `src/lib/reviews.actions.ts`), then `revalidatePath('/[locale]', 'layout')`.

## Recipes

| Request | Do | Don't |
|---|---|---|
| "Let shoppers rate every order" | It's `actions.canRate` → "needs backend support" | `canRate = true`, `status.code === 'delivered'` |
| "Make the driver rating mandatory" | Store setting (`ratingForm.driverRating`) | `required` on the stars yourself |
| "Hide the product rows in the rating dialog" | Store setting (`ratingForm.items`) | Drop the rows in the component |
| "Allow reviews without an order" | Store setting (`write.requiresOrder`) | Skip `orderId` |
| "Show the review right after posting" | Not possible: reviews are approved first | Push it into `items` |
| "Add Telegram to the share menu" | Add a `menuitem` in `ShareButton.tsx` | A share link in another component |
| "Track orders by e-mail" | Backend endpoint → "needs backend support" | A second form field |
| New text | `src/lib/messages/orders-extras.ts` (`en` + `ar`) | Hardcoded strings |

## Tests

- Fixtures: `node scripts/build-account-fixtures.mjs` adds `order-rated.*.json` (#48199, rated) and
  `order-tracked.*.json` (#48200 by number + phone); `node scripts/build-product-fixtures.mjs` refreshes the
  reviews fixtures with `write`. Loaded with `ratedOrderFixture`, `trackedOrderFixture`.
- Components: `OrderRating.test.tsx`, `WriteReview.test.tsx`, `ShareButton.test.tsx`; page:
  `track-order/page.test.tsx`; actions: `orders/actions.test.ts`, `src/lib/reviews.actions.test.ts`;
  mock: `scripts/mock-account.test.mjs` ("orders extras").
- E2E: `e2e/orders-extras.spec.ts`. Mock state: every seeded order was placed with phone `01000000001`;
  #48200 (delivered) can be rated (delivery stars optional, product rows on) and reviewed; #48199 is rated
  already; the mock store takes reviews from any session without an order (`write.requiresOrder` false).
- Live staging: tracking, product reviews and order rating are OFF (`ENABLE_TRACK_YOUR_ORDER`,
  `ENABLE_PRODUCT_RATE`), so these flows are proven on the mock only.
