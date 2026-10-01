# Prescriptions and the address step (`/prescriptions`, `/add-address`)

The old storefront's prescriptions pages, on their old paths. A signed-in customer sends a
prescription (photos or PDF, or the prescription number), follows the ones sent and cancels one the
pharmacy has not started on. The backend decides everything: the form, what blocks sending, the
statuses and whether one can be cancelled. Design: backend `docs/headless/account-extras-v3-design.md` §2.

## Data → UI

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.prescriptions` | The page exists (else 404); the bottom nav's `prescriptions` item (sheet) | `src/app/[locale]/prescriptions/page.tsx`, `src/lib/mobile-nav.ts` |
| `GET /prescriptions/form` → `title`, `description` (RichText), `video` | Page heading, merchant text, "watch how" link | `PrescriptionForm` |
| `.fields` (`type` when several kinds, `prescriptionNumber`, `files` multiple, `note`) | `<FormFields>` (inputs `v.<name>`; files uploaded right away, one id each) | `PrescriptionForm`, `src/components/content/FormFields.tsx` |
| `.addresses` (default first, `selected`) | Radio list; "Add an address" → `/add-address` | `PrescriptionForm` |
| `.blockers` / `.canSend` | Instead of the form: each `message` + the page that clears it (`prescriptionStepHref`: `add_address` → `/add-address`, `verify_phone` → verify-phone, `add_phone` → profile) | `PrescriptionForm`, `src/lib/routing.ts` |
| `POST /prescriptions` (201 `message`, 422 `fields`, 409 `prescription_blocked`) | Thank-you text; the backend's messages under the fields | `src/app/[locale]/prescriptions/actions.ts` |
| `GET /prescriptions` → `items[]` (`reference`, `status.label`, `placedAt`, `type`, `note`, `fileCount`, `address`, `cancellation`) | The list | `PrescriptionsList` |
| `.actions.canCancel` + `GET /prescriptions/cancellation-reasons` | "Cancel prescription" + the reasons dialog (`CancelOrderDialog` with prescription labels) | `CancelPrescription` |

Customer token only (`customerToken()` from `src/lib/session.ts`): a visitor or a guest sees the
sign-in prompt and no guest session is created. Uploads for this page go through
`uploadPrescriptionFileAction` (the customer's token), never `withShopper`.

`/add-address` draws the account address form (`CheckoutSettings.addressForm`) with
`next="prescriptions"`; after saving, `saveAddressAction` goes back to `/prescriptions`.

## Recipes

- **"Make the photos optional" / "require a note"**: the store's setting (`PRESCRIPTION_DEFAULT`) →
  "needs backend support". The `required` of each field comes from the API.
- **"Let them cancel while it is being prepared"**: backend rule (`actions.canCancel`) → "needs backend support".
- **"Add an insurance option"**: the insurance kind comes with the insurance feature (Phase B) → "needs backend support".
- **"Show the prescription photos"**: the API sends `fileCount` only (storage URLs are never sent) → "needs backend support".
- **Restyle**: `src/components/prescriptions/Prescriptions.module.css` (logical properties only).

## Don't

- Decide sending or cancelling yourself (`status.code === 'received'`, `addresses.length`, phone checks):
  rule `prescription-rules-from-api`.
- Add inputs of your own (`name="prescriptionNumber"`): draw `form.fields`.
- Create a guest or use `withShopper` on these pages.

## Tests to update

`src/components/prescriptions/Prescriptions.test.tsx`, `scripts/mock-prescriptions.test.mjs` (mock:
`scripts/mock/prescriptions.mjs`, switches `POST /__mode {"prescriptions": {...}}`), fixtures
`node scripts/build-prescription-fixtures.mjs`, e2e `e2e/prescriptions.spec.ts` + `e2e/mobile.spec.ts`.
