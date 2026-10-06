# Vouchers and cashback (`/account/voucher`, voucher codes at checkout)

The customer's vouchers: codes the store gave them or they added, including cashback vouchers the store
issues when an order is delivered. Not the loyalty rewards (`/account/vouchers`, see loyalty.md). The
backend decides everything: each voucher's one status, what it gives, its minimum order, its credit, its
expiry text, whether a code can be added and why not, and which codes checkout offers. Design: backend
`docs/headless/phase-b-v3-design.md` §2. Off on staging (`ENABLE_VOUCHER` and `ENABLE_CASHBACK_PROMO` off).

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.vouchers` | The page exists (else 404); "My vouchers" on `/account` | `src/lib/vouchers.server.ts` (`vouchersOn`), `src/app/[locale]/account/page.tsx` |
| `GET /vouchers` → `title`, `hint`, `canAdd`, `statuses[]` (`status`, `label`, `count`), `items[]` | `/account/voucher`: one tab per status, the cards of the chosen tab | `VouchersView`, `src/app/[locale]/account/voucher/page.tsx` |
| `Voucher` → `code`, `status`, `statusLabel`, `benefit`, `minimumOrder`, `credit` (Money), `detail`, `expiry` | A card; `data-status` for styling | `VouchersView` (`VoucherCard`) |
| `POST /vouchers {code}` → 201 `message` + `vouchers`; 422 `fields.code` | The add form (when `canAdd`): the backend's message, the new list | `addVoucherAction` (`src/app/[locale]/account/voucher/actions.ts`) |
| `Checkout.promo.suggestions[]` (`code`, `benefit`) | One-tap codes under the promo field; a tap sends `promoCode` | `PromoSection` |
| `Checkout.promo.message` for a cashback code | What the shopper gets after delivery (the discount line is absent: cashback takes nothing off now) | `PromoSection` |

Customer token only on the page (`customerToken()`): a visitor or a guest sees the sign-in prompt. Guests get no suggestions.

## Recipes

- **"Show only active vouchers"**: draw the `active` tab only (the backend still decides which are active).
- **"Apply the first voucher automatically at checkout"**: not done (the old storefront did with `AUTO_SELECT_SUGGESTED_PROMO`) → "needs backend support".
- **"Show a countdown to expiry"**: `expiry` is the backend's text; a countdown needs a backend field → ask.
- **"Copy the code"**: fine, it is `voucher.code` (use a copy button like `loyalty/CopyButton`).
- **Restyle**: `src/components/vouchers/Vouchers.module.css`; the codes at checkout in `Checkout.module.css` (`.suggestion`).

## Don't

- Work out a status from `expiresAt`, usage or credit, re-sort the list, or build "10% off" yourself: rule `voucher-rules-from-api`.
- Validate a code in the browser beyond "not empty" — the backend says why a code is refused.
- Treat a suggestion as applied: only the promo verdict (`promo.applied`) says so.

## Tests to update

`src/components/vouchers/Vouchers.test.tsx`, `src/sdk/v3/loyalty.test.ts` (voucher cases), `scripts/mock-vouchers.test.mjs`
(mock: `scripts/mock/vouchers.mjs`, switch `POST /__mode {"vouchers": {"on": true}}`), fixtures
`node scripts/build-vouchers-fixtures.mjs`, e2e `e2e/vouchers.spec.ts`.
