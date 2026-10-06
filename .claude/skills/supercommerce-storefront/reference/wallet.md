# Wallet: balance, history, paying with it at checkout (`/account/wallet-history`)

The customer's wallet: money the store added (refunds, referral rewards, cashback, deposits) that the
customer can spend at checkout. The backend decides everything: the balance, each history row's title
and sign, whether the wallet is offered at checkout, how much it pays, and whether it pays everything.
Design: backend `docs/headless/phase-b-v3-design.md` §1. Off on staging (`ENABLE_USER_WALLET` off).

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.wallet` | The page exists (else 404); "My wallet" on `/account`; the bottom nav's `wallet` item | `src/lib/wallet.server.ts` (`walletOn`), `src/app/[locale]/account/page.tsx`, `src/lib/mobile-nav.ts` |
| `GET /wallet` → `title`, `balance` (Money), `hint`, `items[]` (`kind`, `title`, `amount` Money signed, `credit`, `date`, `orderId`), `pagination` | `/account/wallet-history`, paginated; "View order" when `orderId` | `WalletView`, `src/app/[locale]/account/wallet-history/page.tsx` |
| `Checkout.wallet` → `label`, `balance`, `selected`, `amount`, `coversTotal`, `message` (null = not offered) | The wallet switch above the payment methods | `src/components/checkout/WalletSection.tsx` |
| `CheckoutSelections.useWallet` (echo: `wallet.selected`) | Ticking the switch sends `useWallet`; `checkoutSelections()` reads it back | `src/sdk/v3/checkout.ts` |
| `totals.lines[kind=wallet]` | A negative line of the breakdown, drawn like the others | `TotalLines` |
| `wallet.coversTotal` | The payment section is not drawn (`payment.methods` is empty and nothing is missing) | `CheckoutView` |

Money (`balance`, `entry.amount`, `wallet.amount`) goes through `<Money>`. Customer token only on the page
(`customerToken()`): a visitor or a guest sees the sign-in prompt and no guest session is created.

## Recipes

- **"Show the balance in the header"**: read it from `GET /wallet` on a server component (customer only), draw it with `<Money>`; there is no balance in `Me` → for a header badge ask for backend support.
- **"Pay with the wallet by default"**: the shopper decides; a store default → "needs backend support".
- **"Show what is left to pay after the wallet"**: that is `totals.total` (the wallet line is already in the breakdown).
- **"Let guests see the wallet"**: v3 is customer-only → "needs backend support".
- **"Hide refunds from the history"**: the backend's list; filtering it would hide money → ask for backend support.
- **Restyle**: `src/components/wallet/Wallet.module.css`, the switch in `Checkout.module.css` (logical properties only). Debits are `[data-credit='false']`.

## Don't

- Compute what the wallet pays (`Math.min(balance, total)`), the rest to pay, or whether it covers the order: rule `wallet-rules-from-api`.
- Pick a payment method when the wallet pays everything: the backend gives legacy one.
- Decide a row is a debit from `amount.amount < 0` (use `credit`) or rebuild its title from `kind`.

## Tests to update

`src/components/wallet/Wallet.test.tsx`, `src/sdk/v3/loyalty.test.ts` (wallet cases), `scripts/mock-wallet.test.mjs`
(mock: `scripts/mock/wallet.mjs`, switches `POST /__mode {"wallet": {"on": true | false, "balance": 150}}`; checkout:
`scripts/mock/checkout.mjs`), fixtures `node scripts/build-wallet-fixtures.mjs`, e2e `e2e/wallet.spec.ts`.
