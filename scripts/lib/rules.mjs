/**
 * Architecture rules of this storefront (see skill/SKILL.md). Each rule says which
 * files it applies to, what it looks for, and how to fix a violation.
 */

const isTest = (file) => /\.test\.(ts|tsx|mjs)$/.test(file) || file.startsWith('src/test/');
const inSdk = (file) => file.startsWith('src/sdk/');
const inUi = (file) => /^src\/(app|components|lib)\//.test(file);
/** SuperCommerce's money components (locked: scripts/lib/money-lock.mjs). */
const inMoney = (file) => file.startsWith('src/money/');

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
      const calls = [...effect.text.matchAll(/\b(\w+Action|(?:mark|add|remove|toggle|clear|move|delete|save|submit)[A-Z]\w*)\s*\(/g)];
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
