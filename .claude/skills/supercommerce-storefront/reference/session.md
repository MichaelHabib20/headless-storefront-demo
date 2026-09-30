# Shopper session (guest + customer)

Personal endpoints (cart, wishlist, compare, notifications) need `Authorization: Bearer <token>`.
The token belongs to a signed-in customer or to a guest. Helpers: `src/lib/shopper.server.ts`.

## Data

| Endpoint | SDK (`@/sdk`) | Returns |
|---|---|---|
| `POST /session/guest` | `createGuestSession(client, locale)` | `{ token, isGuest: true }` — the ONLY way to get a guest token |
| `GET /me` | `getMe(client, { locale, token })` | `Me` — works without a token (all counts 0) |

```ts
interface Me {
  authenticated: boolean;                 // false when no valid token was sent
  isGuest: boolean;
  customer: { firstName: string } | null;
  counts: { cart, wishlist, compare, unreadNotifications };  // header badges; `cart` = lines or units (store setting)
  cartQuantities: Record<string, number>; // productId (as string) → quantity, for "in cart" marks on cards
  wishlistProductIds: number[];           // for filled hearts
  compareProductIds: number[];            // for "in compare" marks
}
```

## Cookies and helpers

| Cookie (all httpOnly, `sameSite: lax`, `secure` in production) | Set by | Holds |
|---|---|---|
| `sc_token` (+ `sc_customer` profile) | sign-in / sign-up (`saveSession`, `src/lib/session.ts`) | customer token — wins over the guest one |
| `sc_guest` | `withShopper` on the first write | guest token (90 days) |

| Helper | Where | Does |
|---|---|---|
| `shopperContext(locale)` | pages, layouts, server components (**reads**) | `{ locale, token }`; `token` may be `null`. Never creates anything. |
| `withShopper(locale, (ctx) => sdkCall(ctx))` | server actions (**writes**): use this | Gets a token (creates the guest session + cookie on the first write); if an expired guest token is rejected (401) it starts a new guest session and retries once |
| `ensureShopperContext(locale)` | only inside `withShopper` | Low-level: returns a token, creating a guest session when there is none |
| `forgetGuest()` | after sign-in / sign-up | Deletes `sc_guest` (the backend has merged it) |

## What the backend decides vs what you decide

| Backend (never re-implement) | You (free to change) |
|---|---|
| Who the shopper is (`authenticated`, `isGuest`, `customer`) | Greeting text and where it shows |
| Every header count (`counts.*`), including lines-vs-units for the cart | Badge style, hiding a badge at 0 |
| Which products are in cart / wishlist / compare | How "in cart" / filled heart looks |
| Merging guest data into the customer at sign-in | When to show sign-in prompts |

## Rules

1. **Token only in httpOnly cookies.** Never pass a token to a `'use client'` component, into
   HTML, a URL, `localStorage` or a log. Client components call server actions; the action reads the cookie.
2. **Reads use `shopperContext`.** No token → don't call personal endpoints (they answer 401): render
   the empty state. `getMe` is the exception: call it without a token, it answers zeros.
3. **Never create a guest while rendering.** `createGuestSession` / `withShopper` only in
   `'use server'` actions or route handlers, and only for a write the visitor asked for (add to cart,
   heart, compare, mark read). A GET, a page view or a prefetch never creates a guest.
4. **401 on a read = no session.** Show the empty state; don't retry, don't create a guest to "fix" it.
5. **Sign-in merges guest data.** Sign-in / sign-up are sent WITH the guest token so the backend merges
   the guest's cart, wishlist and compare; then `forgetGuest()`. Never copy items over one by one.
6. **Header counts come from `getMe`.** Badges show `me.counts.*`. Never count yourself
   (`cart.items.length` is not the badge). After any write, `revalidatePath('/[locale]', 'layout')`
   so the header reads `/me` again.
7. **Personal data is never cached.** The SDK sends `cache: 'no-store'` whenever a token is present;
   don't add `revalidate`/`unstable_cache` around personal reads.
8. **GET never writes.** Don't call a write endpoint from a page render or a `useEffect` on load.

## Recipes

- **Header badges** → layout/header: `getMe(storefrontClient(), await shopperContext(locale))` →
  `me.counts.cart`, `.wishlist`, `.compare`, `.unreadNotifications`. Gate each icon by `layout.features.*`.
- **"Add" button on a product card** → client button → server action: `withShopper(locale, …)` →
  SDK write → `revalidatePath('/[locale]', 'layout')`. Enable it from `purchase.canAddToCart`.
- **Filled heart / "in cart" mark** → `me.wishlistProductIds.includes(id)`, `me.cartQuantities[String(id)]`.
- **"Hi, Sara"** → `me.customer?.firstName` (null for guests and anonymous visitors).
- **Signed in?** → `me.authenticated && !me.isGuest`.

## Tests to update

- Components: `meFixture(locale)` (seeded customer), `anonymousMeFixture()` (no token) from `@/test/fixtures`.
- E2E: sign in by cookie (`sc_token=test-customer`, see [testing.md](testing.md)); assert that browsing
  never sets `sc_guest` and that the first write does.

## Backend behaviors (for maintainers)

- Errors are real HTTP statuses with `{error: {code, message}}`; `unauthenticated` = 401.
- `GET /me` with an invalid token answers `authenticated: false` (no guest is created).
- Contract: `contract/openapi.yaml` ("Shopper session" in the description).
