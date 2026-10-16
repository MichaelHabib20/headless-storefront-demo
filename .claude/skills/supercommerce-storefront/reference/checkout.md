# Checkout and the result page

The most sensitive page of the store: **a shopper must never pay a total they did not see.**
The backend computes the whole checkout; the storefront sends the shopper's choices (never a
price) and draws the answer. Session rules: [session.md](session.md). Cart: [cart.md](cart.md).

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `POST /checkout` `CheckoutSelections` | `computeCheckout(client, ctx, selections)` | Never writes. Call it after every change. First call: no choices (the backend may preselect) |
| `POST /orders` | `placeOrder(client, ctx, { checkout, acceptTerms, returnUrl, idempotencyKey, note, acceptPaymentChange })` | Builds the request **from the checkout you give it**: its choices and its total (`expectedTotal`) |
| `GET /checkout/result?ref=` | `getCheckoutResult(client, ctx, reference)` | The real state (placed / paid / pending / failed / cancelled) |
| `PUT /checkout/contact` | `setCheckoutContact(client, ctx, contact)` | Guests only |
| `GET /pickup-branches` | `getPickupBranches(client, ctx)` | Empty when the store has no pickup |
| `POST /uploads` | `uploadFile(client, ctx, file, name)` | Prescription files; the id goes in `prescriptionFiles` |
| `GET /checkout/settings` | `getCheckoutSettings(client, locale)` | `promoCode`, `orderNote`, `guestEmail`, `notice` |
| — | `checkoutSelections(checkout)` | The choices a checkout was computed for (its echo) |
| — | `freshCheckout(error)` | The fresh checkout sent with `total_changed` / `checkout_incomplete` / `payment_change_needs_consent` |

`Checkout` (abridged): `cart`, `contact`, `fulfilment { options[{type,label,available,reason}], selected,
addresses, addressId, branch, delivery {fee|text, free} }`, `payment { methods[{id,name,icon,online,fee,note,plans}],
selected {methodId, planId} }`, `promo {code, applied, message}`, `requirements.prescription {required, files}`,
`totals { lines[{kind,label,amount|text}], total }`, `minimumOrder`, `missing[]`, `blockers[]`, `messages[]`, `canPlaceOrder`.

## How the page works

- **The API answer is the state.** `CheckoutView` keeps the last `Checkout` and draws everything
  from it, including which options are selected (`fulfilment.selected`, `addressId`, `branch`,
  `payment.selected`, `promo.code`, `prescription.files`). A change sends `checkoutSelections(checkout)`
  plus that one change to `computeCheckoutAction` and swaps in the whole answer.
- **Changes run in order**, each on top of the previous answer. While one is on its way the chosen
  option is marked, but **no amount is shown** (totals, delivery fee, method fees, line totals): they
  belong to the old choices. The place-order button is off.
- **Placing:** `placeOrderAction` (the only caller of `placeOrder`) gets the checkout on screen as one
  piece, and the SDK reads its choices and total. `returnUrl` is our result page on the request's
  origin (`SC_SITE_URL` overrides). `Idempotency-Key` = a key made when the page loaded; it is kept when
  the outcome is unknown (network, server error, `order_in_progress`) and replaced after a refusal.
  - `done` → `/{locale}/checkout/result?checkout=<reference>`; `redirect` → the payment page (http/https only).
  - `total_changed`, `checkout_incomplete`, `payment_change_needs_consent` → the fresh checkout replaces
    the one on screen, the backend message is shown and focused, the terms are unticked: the shopper
    confirms again. For consent the button reads "Accept and place order" and resends with `acceptPaymentChange`.
  - Everything else → the message; the page stays. Nothing is ever retried by itself.
- **Result page** reads only `?checkout=` and asks `getCheckoutResult`. Pending → asks again every 3 s,
  20 times, then a calm "still confirming" message. Unknown status or reference → neutral message + orders link.
- **Addresses:** "Add a new address" links to `routes.addresses(locale) + '?next=checkout'`. The addresses
  page sends the shopper back to `routes.checkout(locale)` (optionally `?address=<id>`, sent as the first choice).
- **Minimum order:** `checkoutMinimumOrder()` (`components/checkout/minimumOrder.ts`) picks the backend verdict:
  the checkout's `minimum_order` blocker; before an address / branch is chosen, the cart's verdict
  (`cart.checkout`, like the cart page); else reached. A missing blocker alone never means "reached".
- **Promo codes:** a refused code (`promo.code` set, `applied: false`) is not kept: `CheckoutView` asks
  again without it and shows the refusal message under the field (old storefront behaviour).
- **Sign in:** `missing: sign_in` shows its message and a link to `/{locale}/session/signin?returnUrl=checkout`;
  sign-in comes back to checkout.

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| Every amount: lines, total, fees, delivery, discounts; `text` instead of an amount | How the summary looks, sticky or not, the order of the sections |
| Which options exist, which is available and why not (`reason`) | Radio cards, dropdowns, tabs — any control that sends the same choice |
| What is preselected (the first call's echo) | — |
| `missing`, `blockers`, `messages`, `promo.message`, result `message` | Where and how those messages look |
| `canPlaceOrder` | The button's look (it stays: `canPlaceOrder && terms && !pending && !placing`) |
| Whether a prescription / plan / contact is needed | The upload control, the contact form layout |

## Rules (enforced by `npm run check:rules`)

1. **`place-order-one-door`** — `placeOrder()` / `placeOrderAction` only in `src/app/[locale]/checkout/`.
   No "buy now" shortcut that skips the checkout the shopper confirms.
2. **`total-from-checkout`** — never write `expectedTotal`, never change `totals` of a checkout, never
   spread a checkout with other totals. Hand the checkout on unchanged.
3. **`place-order-gate`** — the button is enabled by `canPlaceOrder` (and the terms / pending state). No
   `canPlaceOrder || …`, no `!canPlaceOrder && …`, never assign `canPlaceOrder`.
4. **`checkout-no-own-defaults`** — no `methods[0]`, `addresses.find((a) => a.isDefault)` in checkout:
   the backend preselects and echoes.
5. The money rules (`no-price-math`, `money-via-components`, …) and `no-write-on-load` (placing an
   order in a `useEffect`) apply here too.

## Common requests

| Request | Do | Don't |
|---|---|---|
| "Preselect cash on delivery" | Ask the backend to preselect it (a store setting) → "needs backend support" | `paymentMethodId ?? methods[0].id` |
| "Show the delivery fee next to the address" | `checkout.fulfilment.delivery` (fee or text), hidden while pending | Compute or cache a fee per area |
| "Free delivery above 500" | Backend promo / delivery rule; it shows up in `delivery.free` / the lines | `total.amount > 500` |
| "Disable the button until X" | Nothing: `canPlaceOrder` already contains it; show `missing` / `blockers` | Add your own condition |
| "One-click buy on the product page" | Link to the cart / checkout | Call `placeOrder` elsewhere |
| "Show the total while it updates" | No: the old total belongs to the old choices | Keep the previous total on screen |
| "Retry automatically when it fails" | No: show the message; the shopper clicks again (same key when the outcome is unknown) | Loop on `placeOrderAction` |
| "Trust `?status=paid` from the bank" | No: `getCheckoutResult` is the only truth | Read other URL parameters |
| "New UI text" | `src/lib/messages/checkout.ts` (`en` + `ar`) | Hardcode English |

## Tests to update

- SDK: `src/sdk/v3/checkout.test.ts`. Actions (real SDK, fake fetch — they see the exact POST /orders):
  `src/app/[locale]/checkout/actions.test.ts`. Components: `CheckoutView.test.tsx`,
  `CheckoutResultView.test.tsx`; pages: `page.test.tsx`, `result/page.test.tsx`.
- Fixtures: `src/test/checkout-fixtures.ts` (`checkoutFixture`, `firstCheckoutFixture`, `pickupCheckoutFixture`,
  `guestCheckoutFixture`, `checkoutResultFixture(status)`, `pickupBranchesFixture`, `checkoutSettingsFixture`),
  generated by `node scripts/build-checkout-fixtures.mjs`.
- E2E: `e2e/checkout.spec.ts` against the mock.

## The mock (`scripts/mock/checkout.mjs`)

Seeded customer: 196 EGP (below the 300 EGP minimum); `PUT /cart/items/7346 {quantity: 2}` → 356 EGP.
Delivery 25 EGP (Nasr City), pickup free text. Payment 1 cash, 2 card on delivery (+10 EGP),
3 card online (redirect), 4 installments (plans 41/42). Promo `SAVE10` (-10 %), `FREEDEL`, anything else
invalid. Product 14482 needs a prescription. Guest phone `01000000001` → `phone_in_use`.

| Control (mock only) | Effect |
|---|---|
| `POST /api/customer/v3/__checkout {"price": {"productId": 7346, "amount": 170}}` | Changes a price between compute and place → `total_changed` |
| `{"cardDown": true}` | Card online not offered → placing with it → `payment_change_needs_consent` |
| `{"nextOrderError": "order_in_progress" \| "payment_provider_error"}` | The next `POST /orders` answers that error once |
| `{"guestCheckout": false}`, `{"pickup": false}` | Guests must sign in; pickup not available |
| `{"minimumIncludesDelivery": true}` | The minimum counts delivery: no `minimum_order` blocker before an address / branch (seif) |
| `GET /api/customer/v3/__checkout` (with a token) | Switches, every order request received, that shopper's order numbers |
| `GET /api/customer/v3/__pay?ref=` | Mock bank: Pay, Card declined, Cancel, Pay (confirmed 4 s later), Pay (never confirmed) |
