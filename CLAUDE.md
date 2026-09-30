# Storefront — instructions for AI agents

This is a headless storefront on the SuperCommerce storefront API v3.

**Before any change, read `.claude/skills/supercommerce-storefront/SKILL.md`** and the reference
page for the area you're touching. The short version:

1. Only `src/sdk` talks to the backend. Missing data → report "needs backend support".
2. Never compute or format prices, discounts, stock or eligibility — display what the API returns.
   Money goes on screen only through `<Money>` / `<Price>` / `<DiscountLabel>` from `@/money`.
   `src/money` is SuperCommerce's and locked: never edit it, never run `npm run money:lock`.
3. Links to backend content: `<TargetLink target={...}>`; URL scheme only in `src/lib/routing.ts`.
4. UI strings in English **and** Arabic: shared ones in `src/lib/i18n.ts`, area ones in `src/lib/messages/<area>.ts`. Logical CSS for RTL.
5. Personal data (cart, wishlist, compare, notifications): pages only read; writes go through server actions using `withShopper()`. Rendering never creates a guest session.
6. Finish with `npm run verify` and fix every failure. Never disable a rule to get green.
