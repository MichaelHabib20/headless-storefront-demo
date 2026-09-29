# Tests and `npm run verify`

`npm run verify` runs, in order, and stops at the first failure:

| Step | Command | Catches |
|---|---|---|
| Types | `npm run typecheck` | Using fields the contract doesn't have, wrong shapes |
| Lint | `npm run lint` | React/Next mistakes, importing SDK internals, `any` |
| Architecture rules | `npm run check:rules` | Calling the API outside the SDK, legacy fields, building URLs from slugs or hardcoding `/en`/`/ar` paths, price math or price-based rules in the UI, hardcoded UI text in components (must be in i18n), env vars in client code, raw HTML, hardcoded store hosts |
| Contract | `npm run contract:check` | Recorded API responses vs `contract/openapi.yaml`; stale generated types; contract out of sync with the backend |
| Unit + component | `npm run test` | Logic (`src/lib`, `src/sdk`) and components rendered with real recorded data |
| Build | `npm run build` | Anything that breaks the production build |
| E2E | `npm run test:e2e` | The real app in a browser (desktop + mobile, EN + AR) against the mock API |

CI runs the same command (`.github/workflows/verify.yml`), so a failing change can't be deployed.

## Writing tests

- **Logic** (`src/lib/*.ts`, `src/sdk/**`): `*.test.ts` next to the file, Node environment.
- **Components**: `*.test.tsx` next to the component, first line `/** @vitest-environment jsdom */`.
  Render with real data: `homeFixture(locale)` / `layoutFixture(locale)` from `@/test/fixtures`.
  On large trees (the real menu has ~300 items) prefer `container.querySelector` / `getByLabelText`
  over `getByRole` (slow).
- **E2E**: `e2e/*.spec.ts`. Use roles/labels/test ids, not CSS classes. Mobile-only specs go in
  `mobile.spec.ts`.
- Test both `en` and `ar` when you touch text or layout.

## Other commands

| Command | Use |
|---|---|
| `npm run dev` | Local dev against the API in `.env.local` |
| `npm run fixtures:record` | Re-record `src/test/fixtures/v3` from the API (after backend changes) |
| `npm run contract:sync` | Copy the backend contract and regenerate SDK types |
| `npm run contract:check:live` | Validate the live API against the contract |
| `npm run test:e2e:live` | Run e2e against the real API in `SC_API_URL` |
