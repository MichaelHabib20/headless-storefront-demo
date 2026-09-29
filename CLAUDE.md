# Storefront — instructions for AI agents

This is a headless storefront on the SuperCommerce storefront API v3.

**Before any change, read `.claude/skills/supercommerce-storefront/SKILL.md`** and the reference
page for the area you're touching. The short version:

1. Only `src/sdk` talks to the backend. Missing data → report "needs backend support".
2. Never compute prices, discounts, stock or eligibility — display what the API returns.
3. Links to backend content: `<TargetLink target={...}>`; URL scheme only in `src/lib/routing.ts`.
4. UI strings in `src/lib/i18n.ts`, in English **and** Arabic. Logical CSS for RTL.
5. Finish with `npm run verify` and fix every failure. Never disable a rule to get green.
