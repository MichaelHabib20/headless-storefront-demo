# Content pages: CMS pages, contact, branches, landing pages, merchant forms

Everything on these pages is the merchant's content from the API. The storefront draws it; it never
writes page text, legal text, form fields or branch details of its own.

## Data → UI

| API | Route / component | Notes |
|---|---|---|
| `GET /pages/{slug}` → `getPage` → `ContentPage` | `src/app/[locale]/pages/[slug]/page.tsx` → `ContentPageView` | `content` is a `RichText` (cleaned by the backend) → `<RichText>`; `showTitle: false` keeps the `h1` for screen readers only; `iframeUrl` only when it is an http(s) URL (`externalHref`). Metadata: `seoMetadata(page.seo)` |
| `page.kind === 'contact'` | `ContactDetails` + `ContentForm` (fields = `page.contact.fields`) | Read **only** in the page route (checker rule `page-kind-in-route`). The WhatsApp link is `Layout.whatsapp.url` |
| `page.kind === 'branches'` | `BranchesList` over `GET /branches` → `getBranches` | Groups and names as the merchant set them; `mapUrl` is the API's (opened outside the store with `externalHref`) |
| `POST /contact` → `sendContactMessage` | `sendContactAction` (`pages/[slug]/actions.ts`) | Values are re-read for `page.contact.fields` only; no session needed or created; 422 → messages per field |
| `GET /landing-pages/{slug}` → `getLandingPage` | `src/app/[locale]/l/[slug]/page.tsx` | `promoBanners` → `PromoStrip`, `sections` → `HomeSection` (same blocks as the home) |
| `GET /forms/{slug}` → `getForm` → `MerchantForm` | `src/app/[locale]/forms/[slug]/page.tsx` → `ContentForm` + `FormFields` | `requiresSignIn` and no shopper token → sign-in prompt (`routes.signIn(locale, here)`); never a guest while rendering |
| `POST /forms/{slug}/responses` → `submitForm` | `submitFormAction` (`withShopper`) | Values keyed by `field.name`; multi-select → list; a file sends the id from `POST /uploads` (`uploadFormFileAction`) |
| `Layout.legal` | `LegalLinks` (footer), `CookieConsent` "Learn more" | Targets of the merchant's legal pages; null entries → no link |

## FormFields

`src/components/content/FormFields.tsx` draws any `FormField[]`: `text`, `email`, `phone`,
`password`, `date`, `textarea`, `select` (single / `multiple`), `file` (uploads at once, keeps the
id in a hidden input), `checkbox`; unknown kinds are text. Inputs are named `v.<name>`
(`formValues()` in `form-values.ts` reads them back for the described fields only). The form has
`noValidate`: the **backend** validates and its messages are shown next to each field.

## Rules

- Page text, titles, labels, options, "thank you" and error messages come from the API in the
  shopper's language. UI strings (buttons, headings we add) are in `src/lib/messages/content.ts`.
- No legal text in the storefront (checker rule `no-legal-prose`): privacy / terms / cookies are CMS pages.
- `page.kind` is read only by the CMS page route.
- Don't build map links from coordinates; use `branch.mapUrl`.
- Don't add, hide or reorder form fields; a missing field is a merchant setting.

## Recipes

- **"Contact page layout"** → `Content.module.css` (`.contactGrid`), `ContactDetails.tsx`.
- **"Branches as a map / table"** → `BranchesList.tsx` (data: `branch.location`, `branch.mapUrl`).
- **"Add a legal page"** → it's a CMS page the merchant adds (flag it as privacy / terms / cookie
  policy in the admin); it then appears in `Layout.legal` and the footer by itself.
- **"Change the 'Send' button text"** → `contentSend` in `src/lib/messages/content.ts`
  (merchant forms use the API's `submitLabel`).

## Tests to update

`src/components/content/ContentViews.test.tsx`, `form-values.test.ts`, `src/lib/shell.actions.test.ts`
(contact / form actions), `src/sdk/v3/content.test.ts`, `scripts/mock-content.test.mjs`,
`e2e/content.spec.ts`. Fixtures: `node scripts/build-shell-fixtures.mjs` → `src/test/shell-fixtures.ts`.
