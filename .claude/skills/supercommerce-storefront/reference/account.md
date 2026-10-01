# Account: address book and orders

Pages: `/[locale]/account/addresses` (list), `/addresses/new`, `/addresses/[id]/edit`,
`/[locale]/account/orders` (list), `/orders/[id]` (details). Components in `src/components/account/`,
server reads in `src/lib/account.server.ts`, server actions in `src/app/[locale]/account/*/actions.ts`,
strings in `src/lib/messages/account.ts`. Session rules: [session.md](session.md).

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `GET /addresses` | `getAddresses(client, ctx)` | `{ items: Address[] }` |
| `POST /addresses` | `createAddress(client, ctx, input)` | `{ address, items }` |
| `PUT /addresses/{id}` | `updateAddress(client, ctx, id, input)` | `{ address, items }` — **`address.id` may be a NEW id** |
| `DELETE /addresses/{id}` | `deleteAddress(client, ctx, id)` | `{ items }`; the backend picks the new default |
| `POST /addresses/{id}/default` | `setDefaultAddress(client, ctx, id)` | `{ items }` |
| `GET /checkout/settings` | `getCheckoutSettings(client, locale)` | `addressForm` = how the form looks (public) |
| `GET /locations` | `getLocations(client, locale)` | cities → areas → districts (public) |
| `GET /orders?page&perPage` | `getOrders(client, ctx, { page, perPage })` | `OrderSummary[]` + `pagination`, newest first |
| `GET /orders/{id}` | `getOrder(client, ctx, id)` | `Order` (id is a string, not the number) |
| `GET /orders/cancellation-reasons` | `getOrderCancellationReasons(client, ctx)` | `{ items: { id, text }[] }` |
| `POST /orders/{id}/cancel` `{reasonId, note}` | `cancelOrder(client, ctx, id, { reasonId, note })` | `Order`; 409 `cannot_cancel` when not allowed any more |
| `POST /orders/{id}/reorder` | `reorder(client, ctx, id)` | `{ cart, skipped: { name, reason }[] }` |

```ts
interface Address { id; isDefault; city: {id,name}; area; district; values: Record<string, string|null>; formatted: string; deliverable: boolean }
interface Order {
  id; number; placedAt;                          // placedAt: ISO date-time
  status: { code; label; active };               // show label; code only styles
  timeline: { label; done; current }[];          // empty = the store shows none
  fulfilment: { type: 'delivery'|'pickup'; address: string|null; branch: PickupBranch|null };
  payment: { method: string|null; online: boolean };
  items: { name; image; target: ProductTarget|null; quantity; lineTotal: Money; compareAt: Money|null }[];
  totals: { lines: TotalLine[]; total: Money };  // TotalLine: { kind, label, amount: Money|null, text: string|null }
  note: string|null;
  actions: { canCancel: boolean; canReorder: boolean };  // the ONLY switches for the buttons
  // + canRate / canReviewProducts, rating, ratingForm, items[].productId: see orders-extras.md
}
```

## What the backend decides vs what you decide

| Backend (display as-is) | You (free to change) |
|---|---|
| Which address fields and location levels exist, their labels, `required`, `kind` | Layout of the form (columns, order of the blocks), input styling |
| Every validation message (422 `fields`) | Where messages sit, their look |
| The address text (`formatted`), `deliverable`, which one is the default | Card design; showing the default in its own spot |
| Order status text, steps, totals lines, every money text | Badge colors per `status.code` (`statusTone()`), timeline design |
| Whether an order can be cancelled / ordered again (`actions`) | Button style and placement; the cancel dialog design |
| Cancellation reasons, skipped items and their reasons | How the reorder notice looks on the cart page |
| Dates as ISO values | Date format via `formatDate()` (`src/lib/dates.ts`, platform `Intl`) |

## Rules

1. **The address form comes from `addressForm`.** One picker per listed level (city → area → district,
   each fed by the one above), one input per `fields[]` entry in order, with its `label`, `required` and
   `kind` (`phone` → `tel`, `email` → `email`, unknown → text). Values go back under the same names
   (`values: { street: … }`). No field list of your own (`address-form-from-api` rule).
2. **No validation rules of your own** beyond `required` (and a city: `cityId` is required by the
   contract). The API's 422 `fields` are shown next to the input with that name (`street` or
   `values.street`, `areaId`); names with no input → the general message.
3. **After an edit, continue with the id in the answer** (`saved.address.id`): the old id can be gone.
4. **`?next=checkout` is the only return page** (`addressReturn()` in `routing.ts`): after a save the
   form goes to `routes.checkout(locale)`. Never redirect to a URL from the query (no open redirect).
5. **Order actions only from `order.actions`.** "Cancel" when `canCancel`, "Order again" when
   `canReorder`. Never decide from `status.code` or from `placedAt` (`order-actions-from-api` rule).
6. **Money only with `<Money>`**: line totals, `compareAt` (struck through), `totals.lines[].amount`
   (or its `text` when `amount` is null), `totals.total`. Discount lines already carry the minus sign.
7. **Who may see these pages:** a shopper token (customer or guest). No token or a 401 → the sign-in
   prompt, linking to `routes.signIn(locale, <this page>)` (sign-in comes back with `safeReturnPath`).
   Rendering never creates a guest.
8. **Writes are server actions** (`withShopper`), then `revalidatePath('/[locale]', 'layout')`: the
   page re-reads the API (new status, buttons, header cart count).

## How the flows work

- **Cancel:** the page loads the reasons only when `canCancel`. The dialog (focus trapped, Escape
  closes, focus returns) sends `reasonId` + optional note. Success or 409 `cannot_cancel`, the page is
  refreshed from the API; the message (ours for success, the backend's for 409) is announced.
- **Order again:** `reorderAction` → the skipped list goes to `sessionStorage` (read once) →
  `router.push(routes.cart(locale))` → `<ReorderNotice>` on the cart page lists the API's names and reasons.
- **Delete / make default:** the action answers the whole address book; the list shows it.

## Recipes

| Request | Do | Don't |
|---|---|---|
| "Add a landmark field to the address form" | It's a store setting → "needs backend support" | `<input name="landmark">` |
| "Make the area required" | Backend rule (its 422 says so) | `required` on the area picker, own checks |
| "Only allow cancelling pending orders" | Nothing: `actions.canCancel` decides | `status.code === 'pending'` |
| "Cancel within 24 hours only" | Backend rule → "needs backend support" | `Date.now() - placedAt` |
| "Green badge for delivered" | `.tone-done` in `Account.module.css` / `statusTone()` | Rewrite the label |
| "Show 'You saved X'" on an order | Only with a backend field → "needs backend support" | Subtract `compareAt - lineTotal` |
| "Show dates as 28/09/2026" | Change the options in `formatDate()` | Parse or compare dates for rules |
| "Put the default address first" | Already a display order in `AddressBook` | Filter addresses |
| New text | `src/lib/messages/account.ts` (`en` + `ar`) | Hardcoded strings |

## Tests

- Fixtures: `node scripts/build-account-fixtures.mjs` → `src/test/fixtures/v3/{addresses,orders,order,
  order-delivered,order-pickup,cancellation-reasons,reorder,address-form-settings,address-locations}.{en,ar}.json`,
  loaded with `@/test/account-fixtures` (checked by `npm run contract:check`).
- Components: `src/components/account/*.test.tsx`; pages: `src/app/[locale]/account/pages.test.tsx`;
  actions: `…/addresses/actions.test.ts`, `…/orders/actions.test.ts`; mock: `scripts/mock-account.test.mjs`.
- E2E: `e2e/account.spec.ts`. Mock state (`scripts/mock/account.mjs`, reset by `POST /__reset`):
  `test-customer` has address #501 (default, Nasr City) and 12 orders — #48201 in progress
  (`canCancel`, timeline, promo line `-20.00 EGP`, total `408.00 EGP`), #48200 delivered (`canReorder`,
  one product not sold any more → skipped), #48199 picked up (branch, `Free` line, no timeline),
  #48198 cancelled, 8 older ones (one `returned`: unknown status code). Area "Remote Oasis" is not
  deliverable; the mock requires an area and an 11-digit phone; an edit gets a new id.
