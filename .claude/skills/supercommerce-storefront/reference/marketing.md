# Marketing: tags, pixels and events

The merchant configures the tag and pixel ids in the admin; the backend sends them as
`Layout.marketing` (public ids only — secrets such as conversion-API tokens never leave it). The
storefront installs them and fires events. Prices in analytics payloads are the backend's numbers.

## Data → UI

| Backend | Storefront | Code |
|---|---|---|
| `Layout.marketing.gtmId` | Google Tag Manager | `src/components/layout/MarketingTags.tsx` |
| `.googleAnalyticsIds[]`, `.googleAds { conversionId, labels }` | gtag.js (GA4 + Google Ads conversions by event label) | `MarketingTags` + `fireBrowserEvent` |
| `.facebookPixelId`, `.tiktokPixelId`, `.snapchatPixelId`, `.clarityId`, `.hotjarId` | Meta, TikTok, Snapchat pixels, Clarity, Hotjar | `MarketingTags` |
| `Layout.features.cookieConsent` | Nothing loads before the cookie notice is accepted (`sc_cookie_consent` in localStorage); tags load right after the click | `MarketingTags` + `CookieConsent` (`COOKIE_CONSENT_EVENT`) |
| `POST /events` (202) | Server-side twin of each event (conversion APIs), ids only | `src/lib/marketing.server.ts` `trackServerEvent()`, route handler `src/app/api/events/route.ts` |

A null id installs nothing. Ids that are not plain ids are refused.

## Events

| Event | Where it fires | Browser | Server (`POST /events`) |
|---|---|---|---|
| `view_item` | product page (`<TrackEvent event={viewItemEvent(details)}>`) | dataLayer / gtag / fbq / ttq / snaptr | yes (product id) |
| `add_to_cart`, `add_to_wishlist` | `src/lib/shopper.actions.ts` after a successful write | — | yes (`after()`, product id) |
| `search` | search page with `q` | yes | yes (search term) |
| `begin_checkout` | checkout page with items (`beginCheckoutEvent(checkout)`) | yes (checkout total) | yes |
| `purchase` | checkout result page, placed/paid only, **once per checkout reference** (sessionStorage) and `eventId = purchase-<order.id>` (the backend de-duplicates 24 h) | yes (order total) | yes (order id: the backend reports only the shopper's own order) |
| `sign_up`, `login` | sign-up / sign-in server actions after the backend accepted (password, SMS code, provider) — `src/app/[locale]/sign-up/actions.ts`, `sign-in/actions.ts` | — | yes (`after()`) |
| `remove_from_cart`, `view_cart`, `add_payment_info`, `view_item_list`, `select_promotion` | available in `src/lib/marketing.ts`, not wired yet | | |

`track(locale, event)` fires the browser pixels and sends the server twin (sendBeacon →
`/api/events` → `POST /events` with the httpOnly cookies: click ids `sc_click_ids`, `_fbp`/`_fbc`,
the shopper token). Campaign click ids (`fbclid`, `gclid`, `ttclid`, `sccid`) are kept by
`src/middleware.ts` for 7 days.

## Money in analytics

`Money.amount` / `Price.amount` may be read **only** in `src/lib/marketing.ts` (and `src/sdk`), and
only to hand it to a pixel unchanged (`itemFromCard`, `viewItemEvent`, `beginCheckoutEvent`,
`purchaseEvent`). No arithmetic: a list has no `value`; a purchase's value is the order total.
Rule `money-number-for-analytics-only`.

## Recipes

- **"Add a pixel" / "install Pinterest"**: a new id is a store setting → `Layout.marketing` →
  "needs backend support". Then add its snippet in `MarketingTags.tsx` only.
- **"Fire an event when …"**: in a client component `track(locale, { name, items, … })` from
  `@/lib/marketing` on the user's action (or `<TrackEvent>` for a page view); in a server action
  `trackServerEvent(locale, { name, productIds })` from `@/lib/marketing.server`.
- **"Send the price to GA"**: use `itemFromCard(card)` — never compute a value.

## Don't

- Put tag hosts or snippets anywhere but `MarketingTags.tsx` (rule `marketing-tags-one-place`).
- Read `process.env` in client code, or put ids in code (they are the merchant's).
- Send prices to `POST /events` (the backend looks them up) or compute totals for analytics.
- Fire a server action from `useEffect` to track (`track()` is not a write of shopper data).

## Tests to update

`src/lib/marketing.test.ts`, `src/lib/click-ids.test.ts`, `src/components/layout/MarketingTags.test.tsx`,
`src/app/api/events/route.test.ts`, `src/lib/shopper.actions.test.ts`, `scripts/mock-seo.test.mjs`
(`GET /__events`, `POST /__seo {marketing: true}`), e2e `e2e/seo.spec.ts`.
