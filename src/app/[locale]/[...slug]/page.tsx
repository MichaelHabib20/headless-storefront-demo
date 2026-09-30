import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import { isStorefrontPath, routes } from '@/lib/routing';

/** First path segments of routes that exist in the URL scheme but aren't built yet. */
const PLANNED = new Set(['p', 'pages', 'l', 'forms', 'checkout', 'track-order']);

type Params = Promise<{ locale: string; slug: string[] }>;

/**
 * Paths no page matched. The middleware already asked the backend about the ones outside the
 * storefront's routes (src/middleware.ts): redirects never get here; a path the backend says is
 * gone arrives with status 410 and the RESOLUTION_HEADER; everything else is a 404.
 */
async function isGone(locale: string, slug: string[]): Promise<boolean> {
  // The header counts only where the middleware sets it (it replaces it there): outside our routes.
  if (isStorefrontPath(`/${locale}/${slug.join('/')}`)) return false;
  return (await headers()).get(RESOLUTION_HEADER) === 'gone';
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const t = translator(locale);
  return { title: (await isGone(locale, slug)) ? t('catalogGoneTitle') : t('comingSoonTitle'), robots: { index: false } };
}

export default async function UnmatchedPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const t = translator(locale);

  if (await isGone(locale, slug)) {
    return <MessageBlock title={t('catalogGoneTitle')} text={t('catalogGoneText')} cta={{ href: routes.home(locale), label: t('backHome') }} />;
  }
  if (!PLANNED.has(slug[0] ?? '')) notFound();
  return <MessageBlock title={t('comingSoonTitle')} text={t('comingSoonText')} cta={{ href: routes.home(locale), label: t('backHome') }} />;
}
