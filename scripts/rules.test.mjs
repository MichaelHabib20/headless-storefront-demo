import { describe, expect, it } from 'vitest';
import { checkSource } from './lib/rules.mjs';

const rulesHit = (file, source) => checkSource(file, source).map((v) => v.rule);

describe('architecture rules', () => {
  it('catches direct API calls outside the SDK', () => {
    expect(rulesHit('src/components/home/X.tsx', "const r = await fetch('/api/customer/home/sections');")).toContain('sdk-only-network');
    expect(rulesHit('src/sdk/v3/http.ts', 'res = await doFetch(root + path)')).toEqual([]);
  });

  it('catches legacy fields', () => {
    expect(rulesHit('src/components/home/X.tsx', 'if (section.image_type === 3) {')).toContain('no-legacy-fields');
  });

  it('catches link building outside routing', () => {
    expect(rulesHit('src/components/X.tsx', "if (target.type === 'product') return `/p/${target.slug}`;")).toContain('links-via-routing');
    expect(rulesHit('src/components/X.tsx', '<a href={`/p/${product.slug}`}>')).toContain('links-via-routing');
    expect(rulesHit('src/components/X.tsx', "const href = '/brands/' + brand.slug;")).toContain('links-via-routing');
    expect(rulesHit('src/lib/routing.ts', "case 'product':")).toEqual([]);
    // complete URLs from the backend are fine
    expect(rulesHit('src/components/X.tsx', '<a href={profile.url} rel="noopener">')).toEqual([]);
  });

  it('catches price math in the UI', () => {
    expect(rulesHit('src/components/P.tsx', 'const pct = (price.compareAt - price.amount) / price.compareAt;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const total = product.price.amount * qty;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'Math.round(price.amount)')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const sorted = products.sort((a, b) => a.price.amount - b.price.amount);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const sum = items.reduce((total, item) => total + item.lineTotal.amount, 0);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const left = Math.max(0, minimum.amount.amount - subtotal.amount);')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'const hasCents = price.amount % 1 !== 0;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', '<Price price={product.price} locale={locale} />')).toEqual([]);
  });

  it('catches math on the minimum-order progress', () => {
    expect(rulesHit('src/components/cart/M.tsx', 'const missing = 100 - minimumOrder.progressPercent;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'const degrees = minimumOrder.progressPercent * 3.6;')).toContain('no-price-math');
    // used as it is, e.g. as a CSS value, is fine
    expect(rulesHit('src/components/cart/M.tsx', "const bar = { '--cart-progress': `${minimumOrder.progressPercent}%` } as CSSProperties;")).toEqual([]);
  });

  it('catches price-based decisions (tightened: any comparison, not only with a literal)', () => {
    expect(rulesHit('src/components/cart/M.tsx', 'const reached = minimumOrder.remaining.amount === 0;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'if (summary.subtotal.amount >= minimumOrder.amount.amount) {')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', 'const almost = minimumOrder.progressPercent > 80;')).toContain('no-price-math');
    expect(rulesHit('src/components/cart/M.tsx', '{summary.discount && (')).toEqual([]);
    // reading the numbers for analytics is allowed by the contract; `=>` is not a comparison
    expect(rulesHit('src/components/cart/M.tsx', 'track(cart.items.map((item) => item.lineTotal.amount));')).toEqual([]);
    expect(rulesHit('src/components/cart/M.tsx', '<Money value={minimumOrder.amount} />')).toEqual([]);
  });

  it('catches business rules on prices (regression from the AI guardrail trial)', () => {
    expect(rulesHit('src/components/P.tsx', 'const freeDelivery = product.price.amount > 500;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'if (1000 <= price.compareAt) {')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'price.compareAt !== null')).toEqual([]);
  });

  it('lets only src/money read the money texts', () => {
    const fails = [
      '<span className={styles.price}>{product.price.display}</span>',
      '{price?.compareAtDisplay && <s>{price.compareAtDisplay}</s>}',
      "const badge = price.discountLabel ?? '';",
      'const { display } = cart.summary.total;',
      'const texts = lines.map(({ amount, display }) => display);',
      "const text = total['display'];",
      'function Total({ display }: Money) {',
    ];
    for (const line of fails) expect(rulesHit('src/components/cart/X.tsx', line), line).toContain('money-via-components');
    expect(rulesHit('src/lib/x.ts', 'return money.display;')).toContain('money-via-components');
    expect(rulesHit('src/app/[locale]/cart/page.tsx', '<dd>{cart.summary.total?.display}</dd>')).toContain('money-via-components');

    const passes = [
      '<Money value={cart.summary.total} as="dd" data-testid="cart-total" />',
      "el.style.display = 'none';",
      '<h2 className={styles.display}>{title}</h2>',
      "<div style={{ display: 'grid', gap: 8 }}>",
      "<div style={{ display }}>",
      "const visible = getComputedStyle(node).display !== 'none';",
    ];
    for (const line of passes) expect(rulesHit('src/components/cart/X.tsx', line), line).toEqual([]);
    // the money components themselves, and tests checking what the API sent
    expect(rulesHit('src/money/Price.tsx', '{price.compareAtDisplay}')).toEqual([]);
    expect(rulesHit('src/components/cart/X.test.tsx', 'expect(total.textContent).toBe(cart.summary.total.display);')).toEqual([]);
  });

  it('catches money formatted in the storefront', () => {
    const fails = [
      "new Intl.NumberFormat('en', { style: 'currency', currency: price.currency }).format(price.amount)",
      'const count = new Intl.NumberFormat(locale).format(items);',
      '<span>{price.amount.toFixed(2)}</span>',
      'const text = total.amount.toLocaleString();',
      'const text = `${price.currency} ${price.amount}`;',
      "const text = 'EGP ' + total.amount;",
      '<span className={styles.amount}>{price.amount}</span>',
      '<span>{price.currency}</span>',
      '<small>-{price.discountPercent}%</small>',
      'const text = formatNumber(price.amount, locale);',
      'const text = String(item.lineTotal.amount);',
      'formatMoney(total.amount, total.currency, locale)',
      'const { amount, compareAt } = formatPrice(product.price, locale);',
    ];
    for (const line of fails) expect(rulesHit('src/components/product/X.tsx', line), line).toContain('no-money-formatting');

    const passes = [
      '<Price price={product.price} locale={locale} className={styles.price} />',
      '<Money value={minimumOrder.amount} />',
      '<dd data-testid="cart-item-count">{formatQuantity(summary.itemCount, locale)}</dd>',
      'const note = labels.note.replace("{count}", formatNumber(visible.length, locale));',
      "const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(created);",
      'const day = created.toLocaleDateString(locale);',
    ];
    for (const line of passes) expect(rulesHit('src/components/product/X.tsx', line), line).toEqual([]);
    // counts and quantities are formatted in one place
    expect(rulesHit('src/lib/numbers.ts', "return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-EG').format(value);")).toEqual([]);
  });

  it('tells the reader to use the money components', () => {
    const [violation] = checkSource('src/components/P.tsx', '<span>{price.display}</span>');
    expect(violation.message).toContain('<Money value={...} />');
    expect(violation.message).toContain('<Price price={...}');
    const [formatting] = checkSource('src/components/P.tsx', 'const t = price.amount.toFixed(2);');
    expect(formatting.message).toContain('<Money value={...} />');
  });

  it('catches hardcoded UI text and locale paths', () => {
    expect(rulesHit('src/components/P.tsx', '<span className={s.save}>You save {amount}</span>')).toContain('ui-text-in-i18n');
    expect(rulesHit('src/components/P.tsx', '          Free delivery')).toContain('ui-text-in-i18n');
    expect(rulesHit('src/components/P.tsx', '<span>{t("freeDelivery")}</span>')).toEqual([]);
    // arrow functions are code, not JSX text (false positive reported by the cart agent)
    expect(rulesHit('src/components/P.tsx', '    startTransition(() => setState({ busy: true }));')).toEqual([]);
    expect(rulesHit('src/components/P.tsx', '  const items = cart.items.map((item) => toLine({ item, locale }));')).toEqual([]);
    expect(rulesHit('src/components/P.tsx', '<a href="/en/deals">')).toContain('links-via-routing');
  });

  it('catches env reads in client components', () => {
    expect(rulesHit('src/components/C.tsx', "'use client';\nconst key = process.env.SC_API_KEY;")).toContain('no-env-in-client');
    expect(rulesHit('src/lib/storefront.server.ts', 'const key = process.env.SC_API_KEY;')).toEqual([]);
  });

  it('catches raw HTML and hardcoded store hosts', () => {
    expect(rulesHit('src/components/F.tsx', '<div dangerouslySetInnerHTML={{ __html: x }} />')).toContain('no-raw-html');
    expect(rulesHit('src/components/F.tsx', 'ref.current.innerHTML = product.description.html;')).toContain('no-raw-html');
    // the one component that shows the API's cleaned RichText
    expect(rulesHit('src/components/ui/RichText.tsx', '<div dangerouslySetInnerHTML={{ __html: value.html }} />')).toEqual([]);
    expect(rulesHit('src/lib/x.ts', "const base = 'https://staging-seif.witheldokan.com';")).toContain('no-hardcoded-store');
  });

  it('catches writes on page load (regression from the second AI guardrail trial)', () => {
    const onLoad = "'use client';\nuseEffect(() => {\n  void markAllNotificationsReadAction(locale);\n}, [locale]);";
    expect(rulesHit('src/components/notifications/MarkAllReadOnLoad.tsx', onLoad)).toContain('no-write-on-load');
    // a write in a click handler is fine; an effect without a server action is fine
    expect(rulesHit('src/components/N.tsx', "'use client';\nconst onClick = () => markAllNotificationsReadAction(locale);")).toEqual([]);
    expect(rulesHit('src/components/N.tsx', "'use client';\nuseEffect(() => { window.addEventListener('resize', update); }, []);")).toEqual([]);
    // the action passed in as a prop under another name (how the trial agent wrote it)
    const viaProp = "'use client';\nuseEffect(() => {\n  markAllRead().catch(() => undefined);\n}, [markAllRead]);";
    expect(rulesHit('src/components/notifications/MarkAllReadOnLoad.tsx', viaProp)).toContain('no-write-on-load');
    expect(rulesHit('src/components/C.tsx', "'use client';\nuseEffect(() => { addToCart(id); }, [id]);")).toContain('no-write-on-load');
    expect(rulesHit('src/components/C.tsx', "'use client';\nuseEffect(() => { const t = setTimeout(go, 9); return () => clearTimeout(t); }, []);")).toEqual([]);
  });

  it('ignores tests and comments', () => {
    expect(rulesHit('src/components/X.test.tsx', "fetch('/api/customer/x')")).toEqual([]);
    expect(rulesHit('src/components/X.tsx', '// never call fetch( here')).toEqual([]);
  });
});
