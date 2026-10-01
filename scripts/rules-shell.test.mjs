import { describe, expect, it } from 'vitest';
import { checkSource } from './lib/rules.mjs';

const rulesHit = (file, source) => checkSource(file, source).map((v) => v.rule);

describe('shell + content rules', () => {
  it('no legal prose in the storefront', () => {
    expect(rulesHit('src/components/layout/PrivacyPage.tsx', '<p>We collect personal data when you place an order.</p>')).toContain('no-legal-prose');
    expect(rulesHit('src/lib/messages/legal.ts', "termsText: 'By ordering you agree to these terms. Governing law: Egypt.',")).toContain('no-legal-prose');
    expect(rulesHit('src/app/[locale]/privacy-policy/page.tsx', 'const text = "We may share your data with third parties";')).toContain('no-legal-prose');
    // links to the merchant pages are fine
    expect(rulesHit('src/components/layout/LegalLinks.tsx', '<TargetLink target={legal.privacy} locale={locale}>{t(LABELS[kind])}</TargetLink>')).toEqual([]);
    expect(rulesHit('src/lib/messages/shell.ts', "legalPrivacy: 'Privacy policy',")).toEqual([]);
  });

  it('no own bottom nav item list', () => {
    expect(rulesHit('src/components/layout/BottomBar.tsx', "const ITEMS = [{ id: 'home', icon: 'home', href: routes.home(locale) }];")).toContain('mobile-nav-from-api');
    expect(rulesHit('src/components/layout/BottomBar.tsx', "  { href: '/cart', label: t('cart'), icon: 'cart' },")).toContain('mobile-nav-from-api');
    expect(rulesHit('src/lib/nav.ts', "const DEFAULT_FIXED_ITEMS = [{ id: 'home', enabled: true, label_en: 'Home', label_ar: 'الرئيسية' }];")).toContain('mobile-nav-from-api');
    expect(rulesHit('src/components/layout/Bar.tsx', 'const config = JSON.parse(env.BOTTOM_SHEET_CONFIGURATIONS);')).toContain('mobile-nav-from-api');
    // drawing the API items is fine
    expect(rulesHit('src/components/layout/MobileBottomNav.tsx', '{nav.items.map((item) => <NavEntry key={item.id} item={item} />)}')).toEqual([]);
    expect(rulesHit('src/components/layout/UspStrip.tsx', "{ icon: 'verified', title: 'uspGenuineTitle', text: 'uspGenuineText' },")).toEqual([]);
  });

  it('page.kind is read only by the CMS page route', () => {
    expect(rulesHit('src/components/content/PageBody.tsx', "{page.kind === 'contact' && <ContactForm />}")).toContain('page-kind-in-route');
    expect(rulesHit('src/app/[locale]/pages/[slug]/page.tsx', "{page.kind === 'contact' && <ContactBlock />}")).toEqual([]);
    expect(rulesHit('src/components/content/FormFields.tsx', "if (field.kind === 'textarea') {")).toEqual([]);
  });
});
