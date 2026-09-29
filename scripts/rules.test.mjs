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

  it('ignores tests and comments', () => {
    expect(rulesHit('src/components/X.test.tsx', "fetch('/api/customer/x')")).toEqual([]);
    expect(rulesHit('src/components/X.tsx', '// never call fetch( here')).toEqual([]);
  });
});
