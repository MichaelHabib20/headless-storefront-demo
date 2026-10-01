import type { LegalLinks as LegalLinksData, Locale } from '@/sdk';
import { translator, type MessageKey } from '@/lib/i18n';
import { TargetLink } from '../ui/TargetLink';

const LABELS: Record<keyof LegalLinksData, MessageKey> = { privacy: 'legalPrivacy', terms: 'legalTerms', cookies: 'legalCookies' };

/**
 * The store's legal pages (`Layout.legal`): links to the merchant's CMS pages. Their text is the
 * merchant's; the storefront never writes legal text of its own.
 */
export function LegalLinks({ legal, locale, className, linkClassName }: { legal: LegalLinksData | null | undefined; locale: Locale; className?: string; linkClassName?: string }) {
  if (!legal) return null;
  const t = translator(locale);
  const entries = (Object.keys(LABELS) as (keyof LegalLinksData)[]).filter((kind) => legal[kind]);
  if (!entries.length) return null;
  return (
    <nav aria-label={t('legalLinks')} className={className} data-testid="legal-links">
      {entries.map((kind) => (
        <TargetLink key={kind} target={legal[kind]} locale={locale} className={linkClassName}>
          {t(LABELS[kind])}
        </TargetLink>
      ))}
    </nav>
  );
}
