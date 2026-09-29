# Auth: sign in, sign up, session

## Flows

**Sign in**
1. Load `getAuthConfig(client)`.
2. Render one identifier field: phone if `loginMethod === 'phone'`, otherwise email. Plus password.
3. On submit (server-side): re-read the config, call `login(client, { method, email|phone, password })`.
4. Save the returned `Session` (token in an httpOnly cookie) and redirect.

**Sign up**
1. Load `getAuthConfig(client)`.
2. If `signupEnabled` is false: show "sign-up is closed", no form.
3. If `unsupported` is not empty: don't show the form (the backend would reject it); explain why.
4. Render the fields from the table below.
5. Check password confirmation yourself (the backend doesn't), then call `signup(client, input)`.
6. On success the customer is **already signed in**. Save the session. The phone may be unverified (`customer.phoneVerified === false`); that does not block anything.

**Sign out**
- Delete the session cookies. (The current backend doesn't revoke tokens, so there is no API call.)

## Config → UI

| `AuthConfig` field | What the UI does |
|---|---|
| `loginMethod` | `'email'` or `'phone'`: the sign-in identifier field |
| `signupEnabled` | Show or hide sign-up (form and links) |
| `signupEmail` | `'required'`: required email field · `'optional'`: optional field · `'hidden'`: no field |
| `showBirthdate` | Show optional date-of-birth field (`YYYY-MM-DD`) |
| `showReferralCode` | Show optional referral code field |
| `phone.length`, `phone.prefix` | Hints and `maxLength` for the phone field. The backend is the real validator. |
| `unsupported` | Requirements this SDK version can't handle yet; block the sign-up form |
| `otpLoginEnabled` | Not supported by this SDK version yet |

Sign-up fields always shown: first name, last name, phone, password (min 8), password confirmation.

## Errors

| `error.kind` | When | Show |
|---|---|---|
| `validation` | A field is invalid | `error.fieldErrors[field][0]` under each field (fields use SDK names: `firstName`, `lastName`, `email`, `phone`, `password`, `birthdate`, `referralCode`) |
| `invalid_credentials` | Wrong email/phone or password | `error.message` at the top of the form |
| `account_deactivated` | Account disabled | `error.message` |
| `social_account_only` | Account must use social sign-in | `error.message` |
| `not_allowed` | Account can't sign in to the storefront | `error.message` |
| `phone_taken` | Sign-up with a phone that's already registered | Under the phone field (`fieldErrors.phone`) |
| `signup_disabled` | Sign-up turned off while the form was open | `error.message` |
| `rate_limited` | Too many attempts | `error.message`; don't auto-retry |
| `store_unavailable` | Store under construction | `error.message` |
| `network`, `server`, `unknown` | Anything else | `error.message` |

## Don't

- Don't decide email vs phone from your own setting or the URL; only from `loginMethod`.
- Don't validate phone formats with your own regex beyond the hints; the backend decides.
- Don't store the token in `localStorage` or expose it to client components.
- Don't call `GET profile` with a possibly-invalid token: the current backend creates a guest user in that case. Use the `customer` returned by `login`/`signup`.

## Backend behaviors the SDK hides (for maintainers)

- Every response is HTTP 200; the real result is the body `code` (200 ok, 403 login refused, 422 phone taken, 423 validation, 429 rate limit, 401 sign-up disabled, 700 store unavailable).
- Login failures are all `403`; `errors.errorMessage` (`invalid data`, `account deactivated`, `account has social`) tells them apart.
- Some messages come back as untranslated keys (`mobile.errorIncorrectPassword`); the SDK replaces them with readable text.
- Tenant is chosen by the `api-key` header (or the `Referer` host). Language by `lang` (`1` en, `2` ar).
- Backend field names differ from SDK names: `name` → `firstName`, `last_name` → `lastName`, `refered` → `referralCode`.
- The phone-login switch is the `enablePhoneLogin` config key; its values are strings like `"1"` / `"0"`.
