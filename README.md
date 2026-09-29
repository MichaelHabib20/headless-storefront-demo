# SuperCommerce headless storefront

A Next.js storefront built only on the **SuperCommerce storefront API v3**. The home page
shows everything the store's current home page shows (softbar, top bar, header and mega menu,
promo strips, shop-by-category, merchant sections, brands, footer, WhatsApp, cookie notice,
popups) in English and Arabic (RTL), with a black-and-white editorial theme.

## Layers

| Layer | Where | Rule |
|---|---|---|
| Contract | `contract/openapi.yaml` (copy of the backend's `docs/headless/openapi.yaml`) | Source of truth for every field |
| SDK | `src/sdk` (types generated from the contract) | The only code that talks to the API |
| Logic | `src/lib` | Routing (Target → URL), i18n, display formatting, popup rules — pure and unit-tested |
| Components | `src/components` | Reusable UI; render what the API returns |
| Pages | `src/app/[locale]` | Compose components; decide *where* things go |
| Skill | `.claude/skills/supercommerce-storefront`, `CLAUDE.md`, `AGENTS.md` | How humans and AI agents change this repo safely |
| Checks | `scripts/`, `e2e/`, `*.test.ts(x)`, `.github/workflows/verify.yml` | `npm run verify` blocks anything that breaks the rules |

## Run it

```bash
cp .env.example .env.local        # SC_API_URL=https://staging-seif.witheldokan.com
npm install
npm run dev                       # http://localhost:3000/en  ·  /ar
```

## Change it

Read `.claude/skills/supercommerce-storefront/SKILL.md` first (AI agents do this automatically).
Then:

```bash
npm run verify    # types → lint → architecture rules → contract → tests → build → e2e
```

A change is done only when `verify` passes. CI runs the same command on every push.

## Keep it in sync with the backend

```bash
npm run contract:sync          # copy the backend contract, regenerate SDK types
npm run fixtures:record        # re-record real API responses used by tests and the mock API
npm run contract:check:live    # check the live API still matches the contract
```

## Not built yet

Product, category, brand, list, search, cart, wishlist and CMS pages have their final URLs
and show "Coming soon". Newsletter subscription and add-to-cart wait for v3 endpoints.
