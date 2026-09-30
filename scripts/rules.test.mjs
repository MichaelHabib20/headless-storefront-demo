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
    expect(rulesHit('src/components/P.tsx', 'formatPrice(product.price, locale)')).toEqual([]);
  });

  it('catches business rules on prices (regression from the AI guardrail trial)', () => {
    expect(rulesHit('src/components/P.tsx', 'const freeDelivery = product.price.amount > 500;')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'if (1000 <= price.compareAt) {')).toContain('no-price-math');
    expect(rulesHit('src/components/P.tsx', 'price.compareAt !== null')).toEqual([]);
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
