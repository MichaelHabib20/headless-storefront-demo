# Insurance: profiles and insurance prescriptions (`/account/insurance`, `/prescriptions`)

A pharmacy store can take insurance prescriptions. The customer saves their insurance details once (company,
national ID, membership card) and picks them when sending an insurance prescription. The backend decides
everything: which fields exist and which are required (the store's settings), which profiles are the
customer's, the masked national ID, and the prescription rules (pre-approved or not). Design: backend
`docs/headless/phase-b-v3-design.md` §4. Off on staging (`ENABLE_PRESCRIPTION_INSURANCE_COMPANY` off).

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.insurance` | The page exists (else 404); "Insurance" on `/account` | `src/lib/insurance.server.ts` (`insuranceOn`), `src/app/[locale]/account/page.tsx` |
| `GET /insurance` → `title`, `hint`, `fields` (FormField[]), `items` (InsuranceProfile[]) | `/account/insurance`: the profiles and one add / change form | `InsuranceView`, `src/app/[locale]/account/insurance/page.tsx` |
| `InsuranceProfile` → `label`, `company`, `nationalId` (masked), `insuranceNumber`, `documents` (a count) | A card with Change / Delete | `InsuranceView` |
| `POST` / `PUT` / `DELETE /insurance/profiles(/{id})` | Server actions; the answer's `page` replaces the page | `src/app/[locale]/account/insurance/actions.ts` |
| `PrescriptionForm.fields`: `type` = insurance, then `insuranceProfileId`, `preApproved`, `approvalNumber` / `approvalFiles`, `invoiceFiles` with `showWhen` | The insurance fields appear only for that kind (and the approval only when pre-approved) | `FormFields` (`fieldShown`, `watchedValues` in `form-values.ts`) |
| `insuranceProfileId` with no options + its `hint` | A link to the insurance page | `PrescriptionForm` |

Photos are uploaded with `POST /uploads` (the prescriptions upload action) and sent as ids. On a change,
numbers and photos left empty stay as stored (the national ID is only ever shown masked).

## Recipes

- **"Show the full national ID"**: never sent → "needs backend support" (and think twice: it is personal data).
- **"Make the membership number optional"**: a store setting (`INSURANCE_PROFILE_INSURANCE_NUMBER_DEFAULT`) → "needs backend support".
- **"Show the insurance fields always"**: no — `showWhen` is the backend's rule; restyle them instead.
- **Restyle**: `src/components/insurance/Insurance.module.css`.

## Don't

- Hide or show prescription fields by their names or by `type` yourself: use `showWhen` (FormFields does).
- Pick a profile id that is not one of `insuranceProfileId`'s options; never send a stored photo URL.
- Validate the national ID format in the browser: the backend says what it accepts.

## Tests to update

`src/components/insurance/Insurance.test.tsx` (also `showWhen`), `scripts/mock-insurance.test.mjs` (mock: `scripts/mock/insurance.mjs`,
switch `POST /__mode {"insurance": {"on": true}}`; the kind: `scripts/mock/prescriptions.mjs`), fixtures
`node scripts/build-insurance-fixtures.mjs`, e2e `e2e/insurance.spec.ts`.
