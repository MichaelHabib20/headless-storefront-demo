# Auth: sign in / up / out, social, OTP, password reset, verification, approval

Pages: `/[locale]/sign-in`, `/sign-up`, `/forgot-password`, `/reset-password`, `/verify-phone`, `/verify-email`,
`/waiting-approval`, `/account/complete-profile`. Components in `src/components/auth/` (`AuthPage`, `AuthFields`,
`SocialButtons`, `NextStepGate`) and `src/components/layout/AccountMenu.tsx`; server reads in `src/lib/auth.server.ts`,
sign-out in `src/lib/auth.actions.ts`, page actions in `src/app/[locale]/<page>/actions.ts`, strings in
`src/lib/messages/auth.ts`. Session cookies: `src/lib/session.ts` (see [session.md](session.md)).

## Data

| Endpoint | SDK (`@/sdk`) | Notes |
|---|---|---|
| `GET /auth/settings` | `getAuthSettings(client, locale)` | `AuthSettings`: what the pages show (public) |
| `POST /auth/sign-in` | `signIn(client, { locale, token: guestToken }, { identifier, password })` | `Session`; the guest token is merged |
| `POST /auth/sign-up` | `signUp(client, guestCtx, values)` | 201 `Session`; `values` keyed by `signup.fields[].name` |
| `POST /auth/sign-out` | `signOut(client, ctx)` | revokes the token (later calls → 401) |
| `POST /auth/social` | `signInWithProvider(client, guestCtx, { provider, token, name })` | the backend verifies the provider token |
| `POST /auth/social/complete` | `completeSocialProfile(client, ctx, { firstName, lastName, phone, email, birthdate })` | after `next = complete_profile` |
| `POST /auth/otp/send`, `/otp/verify` | `sendOtp(client, locale, phone)`, `signInWithOtp(client, guestCtx, { phone, code })` | only when `otpLogin` |
| `POST /auth/password/forgot` | `forgotPassword(client, locale, { identifier, resetUrl })` | answers `method` (sms / email) |
| `POST /auth/password/reset` | `resetPassword(client, guestCtx, { password, phone, code } \| { password, token })` | signs in |
| `POST /auth/phone/send-code`, `/phone/verify` | `sendPhoneCode(client, ctx)`, `verifyPhone(client, ctx, code)` | customer token |
| `POST /auth/email/verify` | `verifyEmail(client, locale, { email, token })` | from the mail's link |

```ts
interface AuthSettings {
  loginMethod: 'email' | 'phone';                 // the sign-in identifier field
  signup: { enabled: boolean; fields: FormField[] };  // the sign-up form, in order (no field list of ours)
  otpLogin: boolean; passwordReset: { method: 'sms' | 'email' | 'none' };
  social: { google: {clientId} | null; facebook: {appId} | null; apple: {clientId} | null };
  phone: { prefix; length; example };             // hints only; the backend validates
  verifyPhoneAfterSignup: boolean; approval: { required: boolean; waitingText: string | null };
}
interface Session { token: string; customer: Customer; next: 'verify_phone' | 'waiting_approval' | 'complete_profile' | null }
```

## What the backend decides vs what you decide

| Backend (never re-implement) | You (free to change) |
|---|---|
| E-mail or phone sign-in (`loginMethod`); which sign-up / profile fields exist, their labels, order, `required`, selects' options | Layout of the card, input styling, the password confirmation |
| Every refusal and its text (`invalid_credentials`, `account_deactivated`, `social_account_only`, `signup_disabled`, `phone_in_use`, `invalid_code`, `code_expired`, `too_many_attempts`, `provider_error`, `email_in_use`, `wrong_password`, 422 `fields`) | Where the message sits |
| What happens next (`Session.next` / `Me.next`): verify the phone, wait for approval, complete a social profile | How the banner / waiting notice look |
| Which social providers exist and their public ids; whether OTP exists; the reset method | Button design; the tab design |
| Merging the guest's cart / lists at sign-in; revoking tokens at sign-out | Nothing: just send the guest token and drop the cookie |

## Rules

1. **Forms come from the API.** `<AuthFields fields={settings.signup.fields}>` for sign-up, `fields={profile.fields}`
   for the profile. The storefront adds only the password confirmation (`auth-form-from-api` rule). Never read store
   flags (`enablePhoneLogin`, `SIGNUP_EMAIL_CONFIG`...) and never guess e-mail vs phone from the typed text.
2. **Send the identifier as typed.** The backend puts it into the column `loginMethod` names.
3. **Sign in WITH the guest token** (`{ locale, token: await guestToken() }`) so the backend merges the guest's cart,
   wishlist and compare; then `startSession(session)` (saves the httpOnly cookies, forgets the guest).
4. **Follow `Session.next` first**, then the safe return path (`signInReturn`), then the account:
   `afterSignIn()` in `sign-in/actions.ts`; `nextStepHref()` in `routing.ts`.
5. **Sign-out is a server action** (`signOutAction`): `POST /auth/sign-out`, clear `sc_token` / `sc_customer` /
   `sc_guest`, redirect home. The old token answers 401 everywhere afterwards.
6. **Tokens never reach the browser**: httpOnly cookies only (`no-token-in-browser-storage` rule). Social SDK tokens
   go straight to a server action.
7. **Every text is the backend's `message` or an i18n key** (`src/lib/messages/auth.ts`, en + ar). No fallback English.
8. **A page view never writes**: the e-mail confirmation and the phone verification happen on a click.
9. **Social SDKs load only when configured** (`settings.social.<provider>` not null) — `SocialButtons`.
10. **Gates:** a page that needs a customer and gets 401 → `routes.signIn(locale, returnTo)` (`AccountSignIn`).
    `Me.next === 'waiting_approval'` → `NextStepGate` replaces the shop with the waiting notice (auth and CMS pages
    stay open); `verify_phone` → dismissible banner; `complete_profile` → banner.

## Recipes

| Request | Do | Don't |
|---|---|---|
| "Sign in by e-mail instead of phone" | Store setting (`loginMethod`) → "needs backend support" | Change the input type yourself |
| "Add a referral-code / birthdate field to sign-up" | Store setting (`signup.fields`) → "needs backend support" | `<input name="referralCode">` |
| "Add Google sign-in" | Store setting (`social.google`) → "needs backend support" | Hardcode a client id |
| "Remember me / stay signed in" | Cookie `maxAge` in `src/lib/session.ts` | Tokens in `localStorage` |
| "Show 'wrong password' in red" | Style `.alert` in `auth.css` | Write your own message |
| "Skip phone verification" | Store setting (`verifyPhoneAfterSignup`) | Hide the banner / page |
| New text | `src/lib/messages/auth.ts` (`en` + `ar`) | Hardcoded strings |

## Tests

- Fixtures: `node scripts/build-auth-fixtures.mjs` → `auth-settings`, `auth-settings-full`, `session`, `profile`
  `.{en,ar}.json`, loaded with `@/test/auth-fixtures` (checked by `npm run contract:check`).
- Unit: `src/sdk/v3/auth.test.ts`, `sign-in/actions.test.ts`, `sign-up/actions.test.ts`; components
  `AuthFields.test.tsx`, `NextStepGate.test.tsx`, `layout/AccountMenu.test.tsx`; mock `scripts/mock-auth.test.mjs`.
- E2E: `e2e/auth.spec.ts`. Mock (`scripts/mock/auth.mjs`): customers `01222353123 / secret123` (the seeded
  `test-customer`, verified) and `01000000002 / secret123` (not verified, not approved); every code `1234`; e-mail
  reset token `reset-token-ok`; e-mail confirmation token `email-token-ok`; social tokens `google-ok` / `facebook-ok` /
  `apple-ok`. Flags: `POST /__mode {"auth": {"otpLogin": true, "social": {"google": {"clientId": "x"}},
  "passwordReset": "email" | "none", "approval": true, "verifyPhoneAfterSignup": true, "signupEnabled": false,
  "loginMethod": "email", "emailField": "required" | "hidden", "referral": true, "customerGroups": true}}`.
- Live (staging): sign-in / sign-out / revocation / `GET /auth/settings` / profile read with the two test accounts
  only. Social, OTP, verify-after-sign-up, approval and password reset are off on staging → mock only.

## Backend behaviors (for maintainers)

- Real HTTP statuses with `{error: {code, message, fields?}}`; 429 `rate_limited` on the auth endpoints.
- A token issued before the customer's sign-out (or password reset) answers 401 `unauthenticated` on every v3 endpoint.
- Guest tokens are sessions, not customers: `/account/*` and phone verification answer 401 for them.
- The e-mail reset link is the storefront's `/reset-password` page (`resetUrl`, origin allow-listed by the store)
  with `?token=&email=`; the changed-e-mail mail links to `/verify-email?email=&token=`.
