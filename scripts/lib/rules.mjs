/**
 * Architecture rules of this storefront (see skill/SKILL.md). Each rule says which
 * files it applies to, what it looks for, and how to fix a violation.
 */

const isTest = (file) => /\.test\.(ts|tsx|mjs)$/.test(file) || file.startsWith('src/test/');
const inSdk = (file) => file.startsWith('src/sdk/');
const inUi = (file) => /^src\/(app|components|lib)\//.test(file);

const TARGET_TYPES = 'product|category|brand|list|page|landing_page|form|deals|home|url';

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
    applies: (f) => inUi(f) && !isTest(f) && f !== 'src/lib/format.ts',
    patterns: [
      /(amount|compareAt|discountPercent)\s*[-+*/]\s*[\w(]/,
      /[-+*/]\s*[\w.?]*\.(amount|compareAt|discountPercent)\b/,
      /discountPercent\s*[:=][^=]/,
      /Math\.(round|floor|ceil)\([^)]*(price|amount|compareAt)/,
      // business rules on prices ("free delivery above 500") belong to the backend
      /\.(amount|compareAt|discountPercent)\s*[<>]=?\s*\d/,
      /\d\s*[<>]=?\s*[\w.?]*\.(amount|compareAt|discountPercent)\b/,
    ],
    message: 'Prices, discounts, totals and price-based rules come from the backend (Price.amount / compareAt / discountPercent, badges, purchase). Display them with formatPrice(); never compute or compare them. Missing data → "needs backend support".',
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
    applies: (f) => !isTest(f),
    patterns: [/dangerouslySetInnerHTML/],
    message: 'Do not inject HTML. Render backend text as text.',
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
      const call = effect.text.match(/\b\w+Action\s*\(/);
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
