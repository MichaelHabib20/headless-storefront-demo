import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/sdk';
import { legalPageSlug, type LegalKind } from '@/lib/routing';
import { loadLayout } from '@/lib/storefront.server';
import CmsPage, { generateMetadata as cmsMetadata } from '../pages/[slug]/page';

type Params = Promise<{ locale: string }>;

/**
 * The legal pages at the old storefront's root addresses (/privacy-policy, /terms-and-conditions,
 * /cookie-policy). Which CMS page it is comes from `Layout.legal` (the page the admin flagged), so a
 * store whose privacy page has another slug still opens here; without one, the fixed slug.
 */
async function legalSlug(locale: Locale, kind: LegalKind): Promise<string> {
  const layout = await loadLayout(locale).catch(() => null);
  return legalPageSlug(layout?.legal?.[kind], kind);
}

export function legalPage(kind: LegalKind) {
  async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    return cmsMetadata({ params: Promise.resolve({ locale, slug: encodeURIComponent(await legalSlug(locale, kind)) }) });
  }

  async function LegalPage({ params }: { params: Params }) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();
    return CmsPage({ params: Promise.resolve({ locale, slug: encodeURIComponent(await legalSlug(locale, kind)) }) });
  }

  return { generateMetadata, LegalPage };
}
