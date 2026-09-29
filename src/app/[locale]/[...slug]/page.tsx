import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';

/** First path segments of routes that exist in the URL scheme but aren't built yet. */
const PLANNED = new Set(['p', 'c', 'brands', 'lists', 'pages', 'l', 'forms', 'deals', 'search', 'cart', 'wishlist', 'track-order']);

type Params = Promise<{ locale: string; slug: string[] }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('comingSoonTitle') : undefined, robots: { index: false } };
}

export default async function ComingSoonPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  if (!isLocale(locale) || !PLANNED.has(slug[0] ?? '')) notFound();

  const t = translator(locale);
  return <MessageBlock title={t('comingSoonTitle')} text={t('comingSoonText')} cta={{ href: routes.home(locale), label: t('backHome') }} />;
}
