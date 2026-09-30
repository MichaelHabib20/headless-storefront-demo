# AGENTS.md

Instructions for AI coding agents working in this repo: see [CLAUDE.md](CLAUDE.md) and the full
skill at [.claude/skills/supercommerce-storefront/SKILL.md](.claude/skills/supercommerce-storefront/SKILL.md).

Never edit `src/money/` or `scripts/money.lock.json` (SuperCommerce's locked money components):
style money with `className` / `classNames` on `<Money>` / `<Price>` instead.

Verification command: `npm run verify` (must pass before a change is done).
