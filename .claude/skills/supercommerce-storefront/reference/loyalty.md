# Loyalty: points, rewards, history, referral (`/account/your-points`, `/account/vouchers`, …)

The old storefront's loyalty pages, on their old paths, for the two providers v3 supports: **El Dokan**
(built-in points spent on rewards) and **iVend** (an external points service: points, their value and
store credit). The backend decides everything: the points texts, which pages exist, what each reward
gives and costs, whether it can be redeemed and why not. Design: backend
`docs/headless/account-extras-v3-design.md` §3. Off on staging (`LOYALTY_PROVIDER` empty).

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.loyalty` | The pages exist (else 404); "Points and rewards" on `/account`; the bottom nav's `points` item | `src/lib/loyalty.server.ts` (`loyaltyOn`), `src/app/[locale]/account/page.tsx`, `src/lib/mobile-nav.ts` |
| `GET /loyalty` → `title`, `points.text`, `tier`, `pending`, `expiring`, `value` / `storeCredit` (Money), `description` (RichText) | `/account/your-points` | `LoyaltySummaryView` |
| `.sections` (`rewards`, `history`, `referral`) | The links between the loyalty pages (none for iVend) | `LoyaltyNav` |
| `GET /loyalty/rewards` → `points`, `blocker`, `items[]` (`name`, `benefit`, `cost.text`, `badge`, `canRedeem`, `reason`) | `/account/vouchers` | `RewardsList`, `RewardCard`, `LoyaltyBlockerNotice` |
| `GET /loyalty/rewards/{id}` | `/account/vouchers/{id}` (old links `/{id}/{name}` too) | `src/app/[locale]/account/vouchers/[id]/[[...name]]/page.tsx` |
| `POST /loyalty/rewards/{id}/redeem` (201 `redemption.code` / `message`, `points`; 409 `cannot_redeem` with the reason) | "Redeem" only while `canRedeem`; then the code + copy, or the backend's reason | `RedeemReward`, `src/app/[locale]/account/vouchers/actions.ts` |
| `blocker` (`add_phone`, `verify_phone`) | Its `message` + the page that clears it (`loyaltyStepHref`) | `LoyaltyBlockerNotice`, `src/lib/routing.ts` |
| `GET /loyalty/history` → `items[]` (`kind`, `title`, `detail`, `points.text` signed, `date`, `orderId`) | `/account/history`, paginated; "View order" when `orderId` | `PointsHistory` |
| `GET /loyalty/referral` → `code`, `title`, `message`, `shareText` | `/account/get-free-points`: the code, copy code / copy invite text | `ReferralView`, `CopyButton` |

Points are **not money**: they come as `LoyaltyPoints {amount, text}`; show `text`. `value` and
`storeCredit` are `Money` and go through `<Money>`. Customer token only (`customerToken()`): a visitor
or a guest sees the sign-in prompt and no guest session is created. A page the provider does not have
answers 404 from the backend → `notFound()`.

## Recipes

- **"Show how many points until a reward"**: the reward's `reason` already says it ("You need 120 more points").
- **"Let guests see their points"**: v3 is customer-only → "needs backend support".
- **"Add a share-on-WhatsApp button for the referral"**: sharing lives in `ShareButton` (rule
  `share-in-one-place`) → use the copy buttons, or ask for a shared referral share component.
- **"Support GameBall / Sadhan / Mujtama"**: not in v3 yet → "needs backend support".
- **"Hide the history page"**: the backend's `sections` decides; the merchant's provider setting → "needs backend support".
- **Restyle**: `src/components/loyalty/Loyalty.module.css` (logical properties only).

## Don't

- Count or compare points (`points.amount >= cost.amount`), check the phone, or branch on
  `summary.provider` to decide pages: rule `loyalty-rules-from-api`. Use `canRedeem` / `reason`,
  `blocker` and `sections`.
- Draw points with `<Money>` or read a `.display` on them (they have `text`).
- Create a guest or use `withShopper` on these pages.

## Tests to update

`src/components/loyalty/Loyalty.test.tsx`, `src/sdk/v3/loyalty.test.ts`, `scripts/mock-loyalty.test.mjs`
(mock: `scripts/mock/loyalty.mjs`, switches `POST /__mode {"loyalty": {"provider": null | "elDokan" | "ivend",
"phone": "ok" | "unverified" | "missing", "referral": true | false}}`), fixtures
`node scripts/build-loyalty-fixtures.mjs`, e2e `e2e/loyalty.spec.ts` + `e2e/mobile.spec.ts`.
