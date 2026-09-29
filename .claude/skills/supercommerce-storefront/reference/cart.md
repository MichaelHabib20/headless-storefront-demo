# Cart

The backend computes everything in the cart: line totals, subtotal, discount, total, what can be
checked out and why not. The storefront displays it. Session rules: [session.md](session.md).

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `GET /cart` | `getCart(client, ctx)` | Read with `shopperContext`; no token → empty cart state, no call |
| `PUT /cart/items/{productId}` `{quantity}` | `setCartItem(client, ctx, productId, quantity)` | Adds if missing; `0` removes |
| `DELETE /cart/items/{productId}` | `removeCartItem(client, ctx, productId)` | |
| `DELETE /cart` | `clearCart(client, ctx)` | |

Every write returns the **whole new `Cart`** — render it; don't patch your own copy.

```ts
interface Cart {
  items: {
    product: ProductCard;
    quantity: number;
    quantityStep: number;              // 1, or e.g. 0.5 for weighed products
    unitPrice: Price;                  // { currency, amount, compareAt, discountPercent }
    lineTotal: Money;                  // after item promotions — NOT unitPrice × quantity
    availability: {
      status: 'available' | 'out_of_stock' | 'unavailable' | 'coming_soon' | 'exceeds_limit' | 'below_minimum';
      message: string | null;          // localized; null when available
      minQuantity: number;
      maxQuantity: number | null;      // null = no limit
    };
  }[];
  summary: { itemCount, subtotal: Money, discount: Money | null, total: Money };  // total is before delivery
  checkout: {
    allowed: boolean;                  // the ONLY switch for the checkout button
    blockers: { code: 'empty_cart' | 'minimum_order' | 'unavailable_items'; message: string }[];
    minimumOrder: { amount: Money; remaining: Money } | null;   // null = no minimum
  };
  requiresPrescription: boolean;
}
```

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| `lineTotal`, `subtotal`, `discount`, `total` | Layout, where the summary sits, sticky or not |
| Whether checkout is allowed, and the blocker messages | Button style; where blocker messages show |
| `minimumOrder.amount` / `remaining` | Showing them as text (no progress math) |
| Availability status + message, min/max quantity, step | Quantity control (stepper, select), message styling |
| `requiresPrescription` | The prescription notice design |
| Delivery (calculated at checkout, not in the cart) | — |

## Rules

1. **Never compute totals.** Show `summary.total`, `summary.subtotal`, `summary.discount`,
   `item.lineTotal` with `formatMoney(m.amount, m.currency, locale)` from `src/lib/format.ts`. No
   `reduce` over amounts, no `unitPrice.amount * quantity`, no "you save" subtraction
   (`no-price-math` rule).
2. **Never compute remaining / discounts.** "Add X more" is `checkout.minimumOrder.remaining` or the
   `minimum_order` blocker message. Cart-level savings are `summary.discount` (null = none).
3. **Checkout button enabled only by `checkout.allowed`.** Never enable/disable it from your own
   checks (item count, minimum, stock). When it's false, show every `blockers[].message` as given.
   Use `code` for styling / test ids only, never to write your own text.
4. **Availability messages come from the API.** Show `availability.message` when not null. `status`
   may pick a style; it never produces your own sentence. Unknown statuses → show the message, no crash.
5. **Quantity bounds are hints.** Stepper moves by `quantityStep` between `minQuantity` and
   `maxQuantity`; the backend validates (`quantity_not_allowed`, `validation` → `fieldErrors.quantity`).
6. **Writes are server actions** with `ensureShopperContext` (the first add creates the guest), then
   `revalidatePath('/[locale]', 'layout')` so the header count updates.
7. **No delivery in the cart.** `total` is before delivery. Don't show a fee, an estimate or a
   "free delivery above X" rule.

## Errors

| `error.kind` | When | Show |
|---|---|---|
| `quantity_not_allowed`, `validation` | Quantity rejected | `error.message` / `fieldErrors.quantity[0]` next to the line |
| `not_found` | Product no longer sold | Reload the cart (the line is gone) |
| `unauthenticated` | Stale token on a read | Empty cart state |
| `rate_limited`, `server`, `network` | Anything else | `error.message` |

## Recipes

- **"Show a free-delivery progress bar"** → only with a backend field (none in v3) → report
  "needs backend support". Don't hardcode a threshold.
- **"Minimum order progress bar"** → needs a backend ratio field; today show `remaining` as text.
- **"Compute the cart total"** → forbidden; use `summary.total`.
- **"Grey out checkout when an item is out of stock"** → already handled: the backend adds the
  `unavailable_items` blocker and sets `allowed: false`.
- **"Quantity dropdown 1–10"** → build options from `minQuantity`, `maxQuantity`, `quantityStep`.
- **Empty cart** → `items.length === 0` (the `empty_cart` blocker explains it).
- **New UI text** → `src/lib/messages/cart.ts` (`en` + `ar`).

## Tests to update

- Components: `cartFixture(locale)` (2 lines, `minimum_order` blocker, `allowed: false`) and
  `emptyCartFixture(locale)` (`empty_cart` blocker) from `@/test/fixtures`, `en` + `ar`.
- E2E: `e2e/cart.spec.ts` against the mock (seeded customer's cart is below the 300 EGP minimum).
