# Refund bank details (`/account/bank-information`)

Where the store sends a customer's money back when an order is refunded. The backend decides the fields
(bank account, or the post office with a national ID when the store offers it, via `showWhen`), the rules,
and shows what is on record with the IBAN and national ID masked. Design: backend
`docs/headless/phase-b-v3-design.md` §5. Off on staging (`ENABLE_BANK_INFO` off).

| Backend | Where it ends up | Code |
|---|---|---|
| `Layout.features.bankDetails` | The page exists (else 404); "Bank details" on `/account` | `src/lib/bank-details.server.ts`, `src/app/[locale]/account/page.tsx` |
| `GET /account/bank-details` → `title`, `hint`, `fields`, `saved` (`{label, value}`, masked) | The page | `BankDetailsView`, `src/app/[locale]/account/bank-information/page.tsx` |
| `PUT /account/bank-details` (replaces everything; a field not sent is cleared) | The save action; 422 messages under the fields | `src/app/[locale]/account/bank-information/actions.ts` |

Don't: prefill or unmask the IBAN / national ID (only `saved` values exist), validate IBANs in the browser,
or send a field the form does not show. Tests: `src/components/bank-details/BankDetails.test.tsx`,
`scripts/mock-bank-details.test.mjs` (mock `scripts/mock/bank-details.mjs`, `POST /__mode {"bankDetails": {"on": true}}`),
e2e `e2e/bank-details.spec.ts`.
