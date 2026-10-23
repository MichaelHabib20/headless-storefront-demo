/**
 * Architecture rules of this storefront (see skill/SKILL.md). Each rule says which
 * files it applies to, what it looks for, and how to fix a violation.
 */

const isTest = (file) => /\.test\.(ts|tsx|mjs)$/.test(file) || file.startsWith('src/test/');
const inSdk = (file) => file.startsWith('src/sdk/');
const inUi = (file) => /^src\/(app|components|lib)\//.test(file);
/** SuperCommerce's money components (locked: scripts/lib/money-lock.mjs). */
const inMoney = (file) => file.startsWith('src/money/');

/** The checkout page: its route (page, server actions, result page) and its components. */
const CHECKOUT_ACTIONS = 'src/app/[locale]/checkout/actions.ts';
const inCheckoutRoute = (file) => file.startsWith('src/app/[locale]/checkout/');
const inCheckout = (file) => inCheckoutRoute(file) || file.startsWith('src/components/checkout/');

/** SEO + marketing: the one JSON-LD writer, the one tag installer, the one reader of money numbers for analytics. */
const JSONLD = 'src/lib/jsonld.ts';
const MARKETING_TAGS = 'src/components/layout/MarketingTags.tsx';
const MARKETING = 'src/lib/marketing.ts';

const SHOW_MONEY ='Render <Money value={...} /> or <Price price={...} locale={locale} /> from @/money (style them with className / classNames).';

const TARGET_TYPES = 'product|category|brand|list|page|landing_page|form|deals|home|url|tag|search';

export const RULES = [
  {
    id: 'sdk-only-network',
    applies: (f) => !inSdk(f) && !isTest(f),
    patterns: [/\bfetch\s*\(/, /\baxios\b/, /\/api\/customer/],
    message: 'Only src/sdk talks to the backend. Use an SDK function (e.g. getHome) — add one to src/sdk if missing.',
  },
  {
    id: 'no-legacy-fields',
    // src/lib/marketing.ts writes GA4 payloads, whose parameter names (item_id) are not API fields.
    applies: (f) => inUi(f) && !isTest(f) && f !== MARKETING,
    patterns: [/\b(image_type|item_id|discount_price|name_ar|name_en|slug_ar|show_title|dev_key|image_web)\b/],
    message: 'Legacy API fields are not part of the v3 contract. Use the v3 types from @/sdk.',
  },
  {
    id: 'links-via-routing',
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/lib/routing.ts',
    patterns: [
      new RegExp(`\\.type\\s*[!=]==?\\s*['"](${TARGET_TYPES})['"]`),
      new RegExp(`case\\s+['"](${TARGET_TYPES})['"]\\s*:`),
      // building a URL out of a slug/path: `/p/${x.slug}` or '/p/' + x.slug
      /`[^`]*\/[^`]*\$\{[^}]*\.(slug|path)\b/,
      /['"]\/[^'"]*['"]\s*\+\s*[\w.?]*\.(slug|path)\b/,
      // hardcoded locale paths ('/en/...', "/ar") — the locale comes from the route
      /['"`]\/(en|ar)(\/|['"`])/,
    ],
    message: 'Never branch on target.type or build URLs from slugs. Render <TargetLink target={...}> or call resolveTarget() from @/lib/routing.',
  },
  {
    id: 'no-price-math',
    // src/lib/marketing.ts hands the backend's numbers to analytics untouched (rule money-number-for-analytics-only).
    applies: (f) => inUi(f) && !isTest(f) && f !== MARKETING,
    patterns: [
      /(amount|compareAt|discountPercent|progressPercent)\s*[-+*/%]\s*[\w(]/,
      /[-+*/%]\s*[\w.?]*\.(amount|compareAt|discountPercent|progressPercent)\b/,
      /discountPercent\s*[:=][^=]/,
      /Math\.(round|floor|ceil|trunc|min|max|abs)\([^)]*(price|amount|compareAt|discountPercent|progressPercent)/,
      // business rules on prices ("free delivery above 500", "reached when nothing is left")
      // belong to the backend: a money number is never compared with anything
      /\.(amount|compareAt|discountPercent|progressPercent)\s*[<>]=?/,
      /(?<!=)[<>]=?\s*[\w.?]*\.(amount|compareAt|discountPercent|progressPercent)\b/, // (not an arrow `=>`)
      /\.(amount|compareAt|discountPercent|progressPercent)\s*[!=]==?\s*-?\d/,
      /\d\s*[!=]==?\s*[\w.?]*\.(amount|compareAt|discountPercent|progressPercent)\b/,
    ],
    message: `Prices, discounts, totals, the minimum-order progress and price-based rules come from the backend (Price, Money, checkout, badges, purchase): never compute or compare them. ${SHOW_MONEY} Missing data → "needs backend support".`,
  },
  {
    // The backend writes money as text in the shopper's language; only src/money shows it.
    id: 'money-via-components',
    applies: (f) => f.startsWith('src/') && !inMoney(f) && !isTest(f),
    patterns: [
      // price.display, total?.display — but not CSS: style.display, styles.display, getComputedStyle(el).display,
      // nor the drawing hint of a filter, a product option or a section block: facet.display, option.display
      // ('list' | 'color' | …), block.display (a product_list block: 'rail' | 'grid')
      /(?<!\b(?:style|styles|css|\w*[Ff]acet|\w*[Oo]ption|block)\??|getComputedStyle\([^)]*\))\.display\b/,
      /\b(compareAtDisplay|discountLabel)\b/,
      /\[\s*['"`](display|compareAtDisplay|discountLabel)['"`]\s*\]/,
      // destructuring: const { display } = total;  ({ amount, display }) => …;  ({ display }: Money)
      /\{\s*(?:[\w$]+\s*,\s*)*display\s*(?:,[^}]*)?\}\s*(?:=[^=>]|:|\)\s*=>)/,
    ],
    message: `Money text (display, compareAtDisplay, discountLabel) is shown only by the components in src/money. ${SHOW_MONEY}`,
  },
  {
    // Money formatted here would disagree with the backend (rounding, digits, currency).
    // Numbers that are not money are formatted in one place: src/lib/numbers.ts.
    id: 'no-money-formatting',
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/lib/numbers.ts' && f !== MARKETING,
    patterns: [
      /\bformat(?:Money|Prices?|Currency|Amount)\w*/,
      /\bIntl\s*\.\s*NumberFormat\b/,
      /\.toFixed\s*\(/,
      /\.toLocaleString\s*\(/,
      /\bstyle\s*:\s*['"]currency['"]|\bcurrencyDisplay\b/,
      // text built from the numbers: `${price.currency} ${price.amount}`, 'EGP ' + total.amount, String(x.amount)
      /\$\{[^}]*\.(amount|compareAt|discountPercent|currency)\b[^}]*\}/,
      /['"`]\s*\+\s*[\w.?]*\.(amount|compareAt|discountPercent|currency)\b/,
      /\.(amount|compareAt|discountPercent|currency)\s*\+\s*['"`]/,
      /\bString\s*\([^)]*\.(amount|compareAt|discountPercent)\b/,
      /\.(amount|compareAt|discountPercent)\??\.toString\s*\(/,
      // a money number handed to any formatter: formatNumber(price.amount), nf.format(total.amount)
      /\bformat\w*\s*\([^)]*\.(amount|compareAt|discountPercent)\b/,
      // a money number or currency printed in JSX: <span>{price.amount}</span> (props like value={…} are fine)
      /(?<!=\s*)\{\s*[\w.?]*\.(amount|compareAt|discountPercent|currency)\s*\}/,
    ],
    message: `Money is formatted by the backend (Money.display; Price.display, compareAtDisplay, discountLabel). ${SHOW_MONEY} Never format or print amount, compareAt, discountPercent or currency yourself (no Intl.NumberFormat, toFixed, toLocaleString, currency strings). Counts and quantities (not money): formatNumber() from src/lib/numbers.ts.`,
  },
  {
    id: 'ui-text-in-i18n',
    applies: (f) => /^src\/components\/.*\.tsx$/.test(f) && !isTest(f),
    patterns: [
      // JSX text with words: >You save<  or  >Free delivery {x}<
      // (the `>` must not be part of an arrow `=>`, which is code, not JSX)
      /(?<![=\-])>[^<>{}=]*\b[A-Za-z]{3,}\b[^<>{}]*(<|\{)/,
      // a JSX line that is only words:     Free delivery
      /^\s+[A-Za-z][A-Za-z ,.'!?&-]{3,}$/,
    ],
    message: 'UI text must come from src/lib/i18n.ts (English AND Arabic) via t("key"); content text comes translated from the API.',
  },
  {
    // What a shopper may do with an order is `order.actions` (canCancel, canReorder). Deciding it from the
    // status code or the order's age ("cancel while pending", "within 24 hours") drifts from the backend.
    id: 'order-actions-from-api',
    applies: (f) => inUi(f) && !isTest(f),
    patterns: [
      /\bstatus\??\.code\s*[!=]==?/,
      /[!=]==?\s*[\w.?]*status\??\.code\b/,
      /switch\s*\(\s*[\w.?]*status\??\.code\s*\)/,
      /\[\s*['"`][\w-]+['"`]\s*(?:,\s*['"`][\w-]+['"`]\s*)*\]\s*\.includes\s*\(\s*[\w.?]*status\??\.code\b/,
      /\bplacedAt\b[^;]*(?:getTime|Date\.now|valueOf)|(?:getTime|Date\.now)[^;]*\bplacedAt\b/,
    ],
    message:
      'What the shopper may do with an order comes from the API: show "cancel" only when order.actions.canCancel and "order again" only when order.actions.canReorder. status.code is for styling only (statusTone() in src/components/account/status.ts); never decide from it or from the order date.',
  },
  {
    // The address form is described by the API (CheckoutSettings.addressForm): no field list of our own.
    id: 'address-form-from-api',
    applies: (f) => /^src\/(app|components)\//.test(f) && !isTest(f),
    patterns: [/\bname=["'{`]+(?:field\.)?(street|building|floor|apartment|flat|landmark|block|zip|postal_?code|postcode)["'`}]/i],
    message:
      'Address inputs come from CheckoutSettings.addressForm.fields (label, required, kind), drawn by <AddressForm>. Don\'t add address fields of your own: a missing field is a store setting ("needs backend support").',
  },
  {
    id: 'no-env-in-client',
    applies: (f) => !isTest(f),
    when: (source) => /^\s*['"]use client['"]/.test(source),
    patterns: [/process\.env\./],
    message: 'Client components run in the browser: read environment variables (API URL, api-key) only in server code.',
  },
  {
    id: 'no-raw-html',
    // RichText is the one component that shows the backend's cleaned HTML (the API's `RichText`);
    // src/lib/jsonld.ts writes escaped JSON into <script type="application/ld+json">.
    applies: (f) => !isTest(f) && f !== 'src/components/ui/RichText.tsx' && f !== JSONLD,
    patterns: [/dangerouslySetInnerHTML/, /\.innerHTML\b/, /insertAdjacentHTML/],
    message: 'Do not inject HTML. Render backend text as text; formatted text from the API (a RichText value) goes through <RichText value={...} /> from @/components/ui/RichText.',
  },
  {
    id: 'no-hardcoded-store',
    applies: (f) => !isTest(f),
    patterns: [/witheldokan\.com|seif-online\.com|cdn\.supercommerce\.io/],
    message: 'Store URLs come from environment variables and the API, never from code.',
  },
  // --- checkout: a shopper must never pay a total they did not see -------------------------
  {
    // One door to POST /orders: the server action of the checkout page, called by the checkout view.
    id: 'place-order-one-door',
    applies: (f) => f.startsWith('src/') && !inSdk(f) && !isTest(f) && !inCheckoutRoute(f),
    patterns: [/\bplaceOrder\s*\(/, /\bplaceOrderAction\b/],
    message: `Orders are placed in ONE place: placeOrderAction in ${CHECKOUT_ACTIONS}, called by the checkout page with the checkout on screen. Do not call placeOrder() or placeOrderAction from anywhere else (no "buy now" shortcut that skips the checkout the shopper confirms).`,
  },
  {
    // `expectedTotal` is read by the SDK from the checkout that was shown. Anything else could
    // make the shopper pay a total that was never on screen.
    id: 'total-from-checkout',
    applies: (f) => f.startsWith('src/') && !inSdk(f) && !isTest(f),
    patterns: [
      /\bexpectedTotal\b/,
      // a checkout handed on with other totals than the backend's: { ...checkout, totals: … }
      /\.\.\.\s*[\w.?]*checkout\b[^}\n]*\btotals?\s*:/i,
      /\btotals\.total\s*=[^=]/,
    ],
    message: 'The total an order is placed for is the one of the checkout on screen: give that checkout, unchanged, to placeOrder() from @/sdk, which reads its choices and its total. Never build `expectedTotal`, never change `totals` of a checkout.',
  },
  {
    // The backend's switch for the place-order button.
    id: 'place-order-gate',
    applies: (f) => /^src\/(app|components)\//.test(f) && !isTest(f),
    patterns: [
      // enabling by an own condition: canPlaceOrder || x,  x || canPlaceOrder
      /\bcanPlaceOrder\b[^;\n]*\|\|/,
      /\|\|[^;\n]*\bcanPlaceOrder\b/,
      // disabled only when something else is also true: !canPlaceOrder && x,  x && !canPlaceOrder
      /!\s*[\w.?]*\bcanPlaceOrder\b\s*&&/,
      /&&\s*!\s*[\w.?]*\bcanPlaceOrder\b/,
      // overriding it: canPlaceOrder: true,  checkout.canPlaceOrder = true
      /\bcanPlaceOrder\s*[:=](?!=)/,
    ],
    message: 'The place-order button is enabled by the backend (`checkout.canPlaceOrder`), narrowed only by the ticked terms and a pending change. Never enable it by your own condition and never override `canPlaceOrder`: what is missing, minimum orders, stock and payment rules are already inside it. Show `missing` / `blockers` messages instead.',
  },
  {
    // The API answer is the state: the backend preselects and echoes the choices it used.
    id: 'checkout-no-own-defaults',
    applies: (f) => inCheckout(f) && !isTest(f),
    patterns: [
      // the first option as a default: methods[0], addresses?.[0], plans.at(0)
      /\b(methods|addresses|options|plans|branches)\s*(\?\.)?\s*(\[\s*0\s*\]|\.at\(\s*0\s*\))/,
      // the default address picked by the storefront
      /\.(find|filter)\(\s*\(?\s*\w+\s*\)?\s*=>\s*\w+\.isDefault\b/,
    ],
    message: 'Checkout never picks for the shopper: no default address, payment method, branch or plan in the storefront. Send only what the shopper chose; the backend preselects and echoes the choices it used (checkoutSelections(checkout) from @/sdk).',
  },
  // --- orders extras: rating, reviews, sharing ------------------------------------------------
  {
    // Whether an order may be rated / its products reviewed, and whether a shopper may write a review,
    // are backend answers (`order.actions.canRate`, `order.ratingForm`, `reviews.write`). Deriving them
    // ("delivered orders can be rated", "signed-in users can review") drifts from the store's rules.
    id: 'rating-rules-from-api',
    applies: (f) => inUi(f) && !isTest(f),
    patterns: [
      // own values: canRate = …, canRate: true, requiresSignIn = !me.authenticated (reading `order.actions.canRate` is fine)
      /\b(canRate|canReviewProducts|requiresSignIn|requiresOrder)\s*=(?!=)(?!\s*(Boolean\()?[\w.?]*(actions|write|access)\??\.)/,
      /\b(canRate|canReviewProducts|requiresSignIn|requiresOrder)\s*:\s*(?!boolean\b)(true|false|!|[\w(])/,
      // widening by own conditions: canRate || x,  x || canRate
      /\b(canRate|canReviewProducts)\b[^;\n]*\|\|/,
      /\|\|[^;\n]*\b(canRate|canReviewProducts)\b/,
      /\bstatus\??\.code\s*[!=]==?\s*['"]delivered['"]/,
      // an own rating form instead of the API's
      /\bratingForm\s*=(?!=)/,
      /\bratingForm\s*:\s*\{/,
    ],
    message:
      'Rating and review rules come from the API: show "rate" only when order.actions.canRate (fields from order.ratingForm), "write a review" only from reviews.write / order.actions.canReviewProducts. Never derive them from the status, the date or the session.',
  },
  {
    // One share component; everything else links through it (so the share targets stay in one place).
    id: 'share-in-one-place',
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/components/product/ShareButton.tsx',
    patterns: [/\bnavigator\s*\.\s*share\s*\(/, /facebook\.com\/sharer|wa\.me\/\?text|twitter\.com\/intent/],
    message: 'Sharing lives in src/components/product/ShareButton.tsx (Web Share API + the network links). Render <ShareButton> when Layout.features.share; do not add share links elsewhere.',
  },
  // --- auth: the v3 endpoints only, forms drawn from the API, tokens only in httpOnly cookies ----
  {
    // The legacy customer API (`POST /api/customer/auth`, `GET configurations`) and the SDK that wrapped it are gone.
    id: 'auth-via-v3',
    applies: (f) => !isTest(f) && !/^scripts\/lib\/rules\.mjs$/.test(f),
    patterns: [
      /\/api\/customer\/(auth|configurations|profile)\b/,
      /\b(getAuthConfig|toAuthConfig|getRawConfig|loadAuthConfig|storeClient|createClient)\s*\(/,
      /\bfrom\s+['"][^'"]*sdk\/(auth|config|client)['"]/,
      /\b(login|signup)\s*\(\s*client\b/,
    ],
    message:
      'Auth goes through the v3 SDK only: getAuthSettings, signIn, signUp, signOut, signInWithProvider, sendOtp, signInWithOtp, forgotPassword, resetPassword, sendPhoneCode, verifyPhone, verifyEmail, getProfile, updateProfile, changePassword (src/sdk/v3/auth.ts, account.ts). The legacy auth SDK and /api/customer/auth are gone.',
  },
  {
    // Which fields the sign-up / profile forms have, and whether customers sign in by phone or e-mail, is the backend's call.
    id: 'auth-form-from-api',
    applies: (f) => /^src\/(app|components|lib)\//.test(f) && !isTest(f) && f !== 'src/components/auth/AuthFields.tsx',
    patterns: [
      /\b(enablePhoneLogin|ENABLE_PHONE_LOGIN|ENABLE_SHOW_BIRTH_DATE|SIGNUP_EMAIL_CONFIG|USE_REFERRED_AS|DISABLE_REFERRAL_CODE|ENABLE_CUSTOMER_GROUPS|ENABLE_INTERNATIONAL_ADDRESS|enableOtpLogin|ENABLE_GOOGLE_SIGN_IN|ENABLE_FB_SIGN_IN)\b/,
      /\bname=["'{`]+(birthdate|referralCode|customerGroup|country)["'`}]/,
      // deciding the identifier by its shape instead of AuthSettings.loginMethod
      /\b(identifier|value)\.includes\(\s*['"]@['"]\s*\)/,
      /\/\^\[\\?\+?\\?d\s*\][\s\S]{0,20}test\(\s*(identifier|phoneOrEmail)/,
    ],
    message:
      'The sign-in identifier (AuthSettings.loginMethod) and the sign-up / profile fields (AuthSettings.signup.fields, Profile.fields) come from the backend: draw them with <AuthFields> and send the values back under the names it gave. Never read store flags or guess e-mail vs phone in the storefront.',
  },
  {
    // A token in web storage is readable by any script on the page.
    id: 'no-token-in-browser-storage',
    applies: (f) => f.startsWith('src/') && !isTest(f),
    patterns: [/\b(localStorage|sessionStorage)\s*\.\s*setItem\s*\(\s*['"`][^'"`]*(token|sc_token|sc_guest|session|jwt|bearer)[^'"`]*['"`]/i, /\b(localStorage|sessionStorage)\s*\.\s*setItem\s*\([^,]*,\s*[^)]*\b(token|session\.token|jwt)\b/i],
    message: 'Shopper tokens live only in httpOnly cookies set by server code (src/lib/session.ts, shopper.server.ts). Never put a token, a session or a bearer value in localStorage / sessionStorage.',
  },
  // --- seo + marketing ----------------------------------------------------------------------
  {
    // Structured data is written in one place from the backend's facts (Seo.structuredData, GET /seo/site).
    id: 'jsonld-one-place',
    applies: (f) => f.startsWith('src/') && !isTest(f) && f !== JSONLD,
    patterns: [/application\/ld\+json/, /['"]@context['"]\s*:|['"]@type['"]\s*:\s*['"](Product|Offer|BreadcrumbList|Organization|WebSite|LocalBusiness|CollectionPage|ItemList)['"]/],
    message: `JSON-LD is written only by ${JSONLD} from the backend's Seo (structuredData, breadcrumbs) and GET /seo/site: render <JsonLd seo={page.seo} locale={locale} />. A schema.org fact the backend does not send → "needs backend support" (never hardcode one).`,
  },
  {
    // Tags and pixels come from Layout.marketing (merchant settings), after cookie consent.
    id: 'marketing-tags-one-place',
    applies: (f) => f.startsWith('src/') && !isTest(f) && f !== MARKETING_TAGS,
    // connect.facebook.net only for the Meta pixel (fbevents.js, signals): its login SDK (sdk.js) is auth's SocialButtons
    patterns: [/googletagmanager\.com|google-analytics\.com|connect\.facebook\.net\/[^'"`\s]*(fbevents\.js|signals\/)|analytics\.tiktok\.com|sc-static\.net|clarity\.ms|static\.hotjar\.com/, /\b(GTM|G|AW)-[A-Z0-9]{6,}\b/],
    message: `Tag and pixel snippets live only in ${MARKETING_TAGS}, which installs them from Layout.marketing after cookie consent. A new pixel or id is a store setting → "needs backend support" (Layout.marketing); fire events with track() from ${MARKETING}.`,
  },
  {
    // The number of a Price / Money is for analytics only (contract `Money`): read in one place.
    id: 'money-number-for-analytics-only',
    applies: (f) => inUi(f) && !isTest(f) && f !== MARKETING,
    patterns: [
      // price.amount, total?.amount, unitPrice.amount, lineTotal.amount, subtotal.amount ...
      /\b\w*(?:[Pp]rice|[Tt]otal|[Mm]oney|[Cc]ost|[Ff]ee|[Dd]iscount|[Rr]emaining|[Ss]avings?)\??\.amount\b/,
      // destructuring the number: const { amount } = price;  ({ amount, currency }) =>
      /\{\s*(?:[\w$]+\s*,\s*)*amount\s*(?:,[^}]*)?\}\s*(?:=[^=>]|:|\)\s*=>)/,
    ],
    message: `The number of a Price or Money (amount) is for analytics payloads only and is read only in ${MARKETING} (itemFromCard, viewItemEvent, beginCheckoutEvent, purchaseEvent). On screen use <Money> / <Price> from @/money; for an event call track() from ${MARKETING}.`,
  },
  // --- shell + content ------------------------------------------------------------------
  {
    // Privacy policy, terms and cookie policy are the merchant's CMS pages (`Layout.legal`): the
    // storefront links to them and never writes legal text of its own (it would be wrong per store).
    id: 'no-legal-prose',
    applies: (f) => /^src\/(app|components|lib\/messages)\//.test(f) && !isTest(f),
    patterns: [/\b(we collect|we may (?:share|disclose)|personal (?:data|information)|third[- ]part(?:y|ies)|governing law|limitation of liability|data controller|you agree to (?:these|our) terms)\b/i],
    message: 'Legal text (privacy policy, terms, cookie policy) is the merchant\'s CMS content: link to it with <LegalLinks legal={layout.legal} /> or <TargetLink target={layout.legal.privacy}>. A store without such a page → the merchant adds it in the CMS.',
  },
  {
    // The bottom nav is `Layout.mobileNav` (merchant config merged with defaults and filtered by the
    // store's features in the backend). An own item list drifts from the store's settings.
    id: 'mobile-nav-from-api',
    applies: (f) => /^src\/(app|components|lib)\//.test(f) && !isTest(f),
    patterns: [
      /\b(label_en|label_ar|fixed_items|more_menu_items|more_menu_text|bottom_sheet_configurations|BOTTOM_SHEET_CONFIGURATIONS)\b/,
      // an own nav entry list: objects with both an icon and an href
      /\{[^{}]*\bicon\s*:[^{}]*\bhref\s*:|\{[^{}]*\bhref\s*:[^{}]*\bicon\s*:/,
    ],
    message: 'Bottom nav items come from Layout.mobileNav (items, order, labels, icons, badges): render them with <MobileBottomNav nav={layout.mobileNav} />. Adding, removing or reordering an item is a store setting ("needs backend / admin support"), never a list in the storefront.',
  },
  {
    // What a CMS page shows besides its text (`page.kind`) is read in ONE place: its route.
    id: 'page-kind-in-route',
    applies: (f) => inUi(f) && !isTest(f) && !f.startsWith('src/app/[locale]/pages/'),
    patterns: [/\bkind\s*[!=]==?\s*['"](contact|branches)['"]/, /['"](contact|branches)['"]\s*[!=]==?\s*[\w.?]*\bkind\b/],
    message: 'page.kind (contact / branches) is read only by src/app/[locale]/pages/[slug]/page.tsx, which passes the extra block in. Components draw what they are given.',
  },
  // --- account extras: the old storefront's pages on their old paths --------------------------
  {
    // "All products" is its own page (/all-products, the Target {type: search, query: ""}); an empty search is not it.
    id: 'all-products-route',
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/lib/routing.ts',
    // a link to the bare search page (the search form's `action` and the search page's own base path are fine)
    patterns: [/\bhref\s*[=:]\s*\{?\s*routes\.search\(\s*\w+\s*\)/, /\broutes\.search\(\s*\w+\s*,\s*['"`]{2}\s*\)/],
    message: 'Every product lives on routes.allProducts(locale) (the old /all-products page). routes.search(locale, q) is for a search text; a link to "all products" from the API is the Target {type: "search", query: ""}, so render it with <TargetLink>.',
  },
  {
    // Whether a prescription can be sent or cancelled, and which inputs the form has, are the backend's
    // answers (PrescriptionForm.canSend / blockers / fields, Prescription.actions.canCancel).
    id: 'prescription-rules-from-api',
    applies: (f) => !isTest(f) && /^src\/(components\/prescriptions|app\/\[locale\]\/(prescriptions|add-address))\//.test(f),
    patterns: [
      // own cancel / send rules from the status or the customer's data
      /\bstatus\??\.code\s*[!=]==?\s*['"](received|in_progress)['"]/,
      /\b(canSend|canCancel)\s*=(?!=)(?!\s*\{?\s*[\w.?]*(form|actions|item|prescription)\??\.)/,
      /\b(phoneVerified|phone_verified)\b[^;\n]*\b(canSend|blocked|disabled)\b|\b(canSend|blocked|disabled)\b[^;\n]*\b(phoneVerified|phone_verified)\b/,
      // inputs of its own instead of the API's fields
      /\bname=["'{`]+(v\.)?(prescriptionNumber|prescription_number|prescription_images)["'`}]/,
    ],
    message:
      'Prescription rules come from the API: send only when form.canSend (show form.blockers[].message and the page prescriptionStepHref() gives), draw form.fields with <FormFields>, cancel only when item.actions.canCancel. Never derive them from the status, the addresses or the phone.',
  },
  {
    // Points, what a reward costs, whether it can be redeemed and why not, and which loyalty pages exist
    // are the backend's answers (LoyaltyPoints.text, LoyaltyReward.canRedeem / reason, LoyaltyBlocker,
    // LoyaltySummary.sections): the storefront never counts points or branches on the provider.
    id: 'loyalty-rules-from-api',
    applies: (f) => !isTest(f) && /^src\/(components\/loyalty\/|app\/\[locale\]\/account\/(your-points|vouchers|history|get-free-points)\/|lib\/loyalty\.server\.ts$)/.test(f),
    patterns: [
      // `amount` is for analytics only: no comparing or adding points
      /\.amount\b/,
      /\bcanRedeem\s*=(?!=)(?!\s*\{?\s*[\w.?]*reward\??\.)/,
      // which pages exist: `sections`, never the provider's name
      /\bprovider\s*[!=]==?\s*['"]|['"](elDokan|ivend)['"]\s*[!=]==?/,
      // the legacy switches and rules, and the customer's phone (the API sends `blocker`)
      /\b(LOYALTY_PROVIDER|DISABLE_REFERRAL_CODE|LOYALTY_EX_RATE|egp_gold|refer_points|point_cost|is_gold|isGold|phoneVerified|phone_verified)\b/,
    ],
    message:
      'Loyalty rules come from the API: show points.text and reward.cost.text as they are, redeem only when reward.canRedeem (else show reward.reason), show blocker.message with the page loyaltyStepHref() gives, and link the pages LoyaltySummary.sections lists. Never count points, compare amounts, check the phone or branch on the provider.',
  },
  {
    // phase B: what the wallet pays, whether it pays everything, the balance and the sign of every
    // history row are the backend's (Checkout.wallet, Wallet, WalletEntry.credit). The storefront asks
    // with `useWallet` and draws; it never works out the amount, the rest to pay or a debit.
    id: 'wallet-rules-from-api',
    applies: (f) => !isTest(f) && /^src\/(components\/wallet\/|components\/checkout\/WalletSection\.tsx$|app\/\[locale\]\/account\/wallet-history\/|lib\/wallet\.server\.ts$)/.test(f),
    patterns: [
      // no reading the number of a Money (`balance.amount`, `entry.amount.amount`, `total.amount`): it goes through <Money>
      /\b(balance|amount|total)\.amount\b/,
      /(?<![-\w])(coversTotal|credit)\s*=(?!=)(?!\s*\{?\s*[\w.?]*(wallet|entry|item)\??\.)/,
      // the legacy switch and fields
      /\b(ENABLE_USER_WALLET|ENABLE_WALLET_FOR_GUESTS|wallet_balance|use_wallet|wallet_paid_amount)\b/,
    ],
    message:
      'Wallet rules come from the API: send useWallet and draw Checkout.wallet (label, balance, message, coversTotal) and the wallet line of totals; show Wallet.balance and each entry.amount with <Money>, style by entry.credit. Never compute what the wallet pays, the rest, or whether it covers the order.',
  },
  {
    // phase B: a voucher's status, what it gives, its minimum, credit and expiry text are the backend's
    // (Voucher); the tabs are `statuses`. The storefront never re-sorts vouchers by date or builds "% off".
    id: 'voucher-rules-from-api',
    applies: (f) => !isTest(f) && /^src\/(components\/vouchers\/|app\/\[locale\]\/account\/voucher\/|lib\/vouchers\.server\.ts$)/.test(f),
    patterns: [
      // dates: `expiry` is the backend's text
      /\bexpiresAt\b[^;\n]*(new Date|Date\.|<|>|getTime|compare)|\b(new Date|Date\.now)\b[^;\n]*\bexpiresAt\b/,
      // building what a voucher gives, or reading a Money number
      /%\s*off|\bamount_type\b|\bmax_amount\b|\bminimum_amount\b|\b(remaining|total)\.amount\b/,
      /(?<![-\w])status\s*=(?!=)(?!\s*\{?\s*[\w.?]*(voucher|status|item)\??\.)/,
    ],
    message:
      'Voucher rules come from the API: group by voucher.status using Vouchers.statuses (labels and counts), show benefit, minimumOrder, credit (with <Money>), detail and expiry as they are. Never compute a status from dates or usage, or build the value text.',
  },
];

/**
 * Server actions (…Action) are writes. Calling one inside a useEffect writes just because a page
 * opened (e.g. "mark all as read on load") — GET/viewing must never change data.
 * Found by the AI guardrail trial; needs the effect's body, so it's a file-level check.
 */
const WRITE_ON_LOAD = {
  id: 'no-write-on-load',
  message: 'Viewing a page must never change data: do not call server actions (…Action) from useEffect. Writes happen only on a user action (click/submit).',
};

const SAFE_EFFECT_CALLS = new Set(['addEventListener', 'removeEventListener', 'clearTimeout', 'clearInterval', 'removeItem', 'removeAttribute', 'addListener', 'removeListener']);

function effectBodies(source) {
  const bodies = [];
  const pattern = /\buseEffect\s*\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    let depth = 1;
    let i = match.index + match[0].length;
    for (; i < source.length && depth > 0; i++) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
    }
    bodies.push({ start: match.index, text: source.slice(match.index, i) });
  }
  return bodies;
}

/** @returns {{rule: string, file: string, line: number, text: string, message: string}[]} */
export function checkSource(file, source) {
  const violations = [];
  const lines = source.split(/\r?\n/);

  if (/^src\/(app|components)\//.test(file) && !isTest(file)) {
    for (const effect of effectBodies(source)) {
      // Server actions (…Action) and write-style calls, including actions passed in as props
      // (e.g. `markAllRead()`); browser APIs like addEventListener / clearTimeout are fine.
      const calls = [...effect.text.matchAll(/\b(\w+Action|(?:mark|add|remove|toggle|clear|move|delete|save|submit|place)[A-Z]\w*)\s*\(/g)];
      const call = calls.find((c) => !SAFE_EFFECT_CALLS.has(c[1]));
      if (!call) continue;
      const line = source.slice(0, effect.start + effect.text.indexOf(call[0])).split(/\r?\n/).length;
      violations.push({ rule: WRITE_ON_LOAD.id, file, line, text: lines[line - 1].trim(), message: WRITE_ON_LOAD.message });
    }
  }
  for (const rule of RULES) {
    if (!rule.applies(file) || (rule.when && !rule.when(source))) continue;
    lines.forEach((text, index) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(text)) return; // comments explain rules; they don't break them
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        violations.push({ rule: rule.id, file, line: index + 1, text: text.trim(), message: rule.message });
      }
    });
  }
  return violations;
}
