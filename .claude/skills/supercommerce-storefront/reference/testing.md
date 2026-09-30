# Tests and `npm run verify`

`npm run verify` runs, in order, and stops at the first failure:

| Step | Command | Catches |
|---|---|---|
| Types | `npm run typecheck` | Using fields the contract doesn't have, wrong shapes |
| Lint | `npm run lint` | React/Next mistakes, importing SDK internals, `any` |
| Architecture rules | `npm run check:rules` | Calling the API outside the SDK, legacy fields, building URLs from slugs or hardcoding `/en`/`/ar` paths, price math or price-based rules in the UI, money shown outside `src/money` or formatted in the storefront, any change to the locked `src/money` folder, hardcoded UI text in components (must be in i18n), writes on page load (server actions in `useEffect`), env vars in client code, raw HTML, hardcoded store hosts |
| Contract | `npm run contract:check` | Recorded API responses and shopper fixtures vs `contract/openapi.yaml`; stale generated types; contract out of sync with the backend |
| Unit + component | `npm run test` | Logic (`src/lib`, `src/sdk`, helpers), components rendered with real data, the mock API vs the contract (`scripts/mock-shopper.test.mjs`) |
| Build | `npm run build` | Anything that breaks the production build |
| E2E | `npm run test:e2e` | The real app in a browser (desktop + mobile, EN + AR) against the mock API |

CI runs the same command (`.github/workflows/verify.yml`), so a failing change can't be deployed.

## Writing tests

- **Logic** (`src/lib/*.ts`, `src/sdk/**`, helpers next to components): `*.test.ts` next to the file, Node environment.
- **Components**: `*.test.tsx` next to the component, first line `/** @vitest-environment jsdom */`.
  Render with real data from `@/test/fixtures`: `homeFixture`, `layoutFixture`, and for shopper
  pages `meFixture`, `anonymousMeFixture`, `cartFixture`, `emptyCartFixture`, `wishlistFixture`,
  `compareFixture`, `notificationsFixture` (all take `locale`).
  On large trees (the real menu has ~300 items) prefer `container.querySelector` / `getByLabelText`
  over `getByRole` (slow).
- **Server actions in component tests**: pass the actions as props and give `vi.fn()` in tests
  (see `NotificationsView.test.tsx`). `<form action={fn}>` works in jsdom; clicking a `next/link`
  tries to navigate, so stop anchor clicks with a `document` click listener that calls `preventDefault()`.
- **E2E**: `e2e/*.spec.ts`, one spec per area. Use roles/labels/test ids, not CSS classes.
  Mobile-only specs go in `mobile.spec.ts`.
- Test both `en` and `ar` when you touch text or layout.
- **Money in tests**: give data with a `display` text and assert the page shows exactly that text
  (unit tests use odd texts like `'PRICE-TEXT-1'`; fixtures and the mock use the backend's format,
  e.g. `176 EGP`, `196.00 EGP`, `176 جنية`, `10 %`).
  Never assert a format the storefront would produce — it produces none.

## The locked money folder

`src/money` (`Money`, `Price`, `DiscountLabel`) belongs to SuperCommerce and will become an npm
package. `scripts/money.lock.json` holds a sha256 of every file in it (line endings ignored);
`npm run check:rules` fails if a file there is changed, added or removed. The fix is always to undo
the change and style money from your own components (`className`, `classNames`, `as`).

`npm run money:lock` rewrites the lock — **SuperCommerce maintainers only**, after they changed the
components. Never run it to make a check pass. The lock itself is tested in
`scripts/money-lock.test.mjs` with temporary folders.

## E2E specs

| Spec | Covers |
|---|---|
| `home.spec.ts` | Chrome, home content, links, language switch, 404, cookie notice, API down |
| `mobile.spec.ts` | Mobile menu and layout (mobile project only) |
| `notifications.spec.ts` | List + unread state, mark one, mark all, opening marks read, reading never marks read, pagination, Arabic, no guest for anonymous visitors |
| `cart.spec.ts` | Cart lines, quantity changes (totals from the API), remove, blockers, guest empty cart, Arabic |
| `wishlist-compare.spec.ts` | Wishlist grid, remove, move to cart, pagination, compare table, remove, Arabic, guest empty states |
| `product.spec.ts` | Product page: options as links, add with quantity, wishlist/compare, notify-me (email asked by the API, 409), coming soon, discount, gallery keyboard + video, redirect, reviews pages, 404, API down, Arabic, 360 px |
| `shopper-actions.spec.ts` | Card buttons on the home page (add to cart as a guest, wishlist/compare toggles, `compare_full`), header counts |
| `catalog.spec.ts` | Listings (filters, chips, clear all, sort, pages, price form), search + suggestions, every listing route, categories/brands pages, 404/invalid, Arabic, phone drawer, no-JS filters, unknown paths (301/302/410/404) |
| `shopper-live.spec.ts` | The same flows against real staging as a guest and as the test customer (`E2E_LIVE=1`) |

Helpers in `e2e/support.ts`: `signInAsCustomer(context)` (mock: `test-customer`; live: signs in with
`E2E_PHONE`/`E2E_PASSWORD` from `.env.local`), `resetMock(page)`, `acceptCookies(page)`, `live`.

## The mock API (e2e + `npm run dev` without a backend)

`scripts/mock-api.mjs` on `http://127.0.0.1:4010`. `layout`/`home` are the recorded fixtures; the
shopper endpoints are an in-memory store (`scripts/mock/shopper.mjs`) that follows the contract
(checked by `scripts/mock-shopper.test.mjs`).

| State | Value |
|---|---|
| Seeded customer | `Bearer test-customer`: cart 2 lines (below the 300 EGP minimum → `minimum_order` blocker), wishlist 3, compare 2 (max 4), 25 notifications with #903 read (24 unread) |
| Guests | `POST /session/guest` → `guest-1`, `guest-2`, …; guests only get broadcast notifications |
| Clock | Fixed at `2026-09-29T10:00Z` for notification dates |
| Money | Texts written like the backend's MoneyFormatter (`priceText()` / `totalText()`): prices `18 EGP` / `18 جنية`, totals and the minimum `196.00 EGP`, discount `10 %`; the seeded cart is 65% of the 300 EGP minimum |
| `POST /__reset` | Fresh state (seeded customer back, guests gone) |
| `POST /__mode {"fail": true}` | Every API call answers 500 until `{"fail": false}` |

State is shared by all tests (one server, one worker): **reset in `beforeEach`**, and skip
state-dependent specs on the live API.

```ts
const live = process.env.E2E_LIVE === '1';
const MOCK_API = 'http://127.0.0.1:4010';
test.skip(live, 'needs the mock API state');

test.beforeEach(async ({ request, page, context }) => {
  await request.post(`${MOCK_API}/__reset`);
  await page.addInitScript(() => window.localStorage.setItem('sc_cookie_consent', 'accepted'));
  // Signed in as the seeded customer (httpOnly cookie, like the real sign-in sets it):
  await context.addCookies([{ name: 'sc_token', value: 'test-customer', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
});
```

- **Check what the backend stored**, not only the page: `request.get(`${MOCK_API}/api/customer/v3/me`,
  { headers: { Authorization: 'Bearer test-customer' } })` → `data.counts`.
- **"GET never writes"**: load the page, reload, then assert the `/me` counts didn't change.
- **Guests**: without cookies, a page view must not set `sc_guest` (`(await context.cookies())`);
  the first write must.
- Shopper fixtures come from the mock: after changing `scripts/mock/shopper.mjs`, run
  `node scripts/build-shopper-fixtures.mjs` (until they are recorded live with `npm run fixtures:record`).

## Other commands

| Command | Use |
|---|---|
| `npm run dev` | Local dev against the API in `.env.local` |
| `node scripts/mock-api.mjs` | Mock API on :4010 (set `SC_API_URL=http://127.0.0.1:4010`) |
| `npm run fixtures:record` | Re-record `src/test/fixtures/v3` from the API (after backend changes) |
| `npm run contract:sync` | Copy the backend contract and regenerate SDK types |
| `npm run contract:check:live` | Validate the live API against the contract |
| `npm run money:lock` | SuperCommerce maintainers only: re-pin `src/money` after changing it |
| `npm run test:e2e:live` | Run e2e against the real API in `SC_API_URL` |
