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

const SHOW_MONEY = 'Render <Money value={...} /> or <Price price={...} locale={locale} /> from @/money (style them with className / classNames).';

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
    applies: (f) => inUi(f) && !isTest(f),
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
    applies: (f) => inUi(f) && !isTest(f),
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
      // nor the drawing hint of a filter or a product option: facet.display, option.display ('list' | 'color' | …)
      /(?<!\b(?:style|styles|css|\w*[Ff]acet|\w*[Oo]ption)\??|getComputedStyle\([^)]*\))\.display\b/,
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
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/lib/numbers.ts',
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
    // RichText is the one component that shows the backend's cleaned HTML (the API's `RichText`).
    applies: (f) => !isTest(f) && f !== 'src/components/ui/RichText.tsx',
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
