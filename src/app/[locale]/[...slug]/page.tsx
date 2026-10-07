import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { MessageBlock } from '@/components/layout/StoreUnavailable';
import { translator } from '@/lib/i18n';
import { RESOLUTION_HEADER } from '@/lib/resolve';
import { isStorefrontPath, RESERVED_SEGMENTS, routes } from '@/lib/routing';
import ProductPage, { generateMetadata as productMetadata } from '../_product/ProductPage';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string[] }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** `/{locale}/{slug}`: the old storefront's product address (a single segment that is not reserved). */
function productSlug(slug: string[]): string | null {
  return slug.length === 1 && !RESERVED_SEGMENTS.has(slug[0]) ? slug[0] : null;
}

/**
 * Paths no other page matched: a product (one segment), or a path the middleware already asked the
 * backend about (src/middleware.ts): redirects never get here; a gone path arrives with status 410 and
 * the RESOLUTION_HEADER; everything else is a 404.
 */
async function isGone(locale: string, slug: string[]): Promise<boolean> {
  // The header counts only where the middleware sets it (it replaces it there): outside our routes.
  if (isStorefrontPath(`/${locale}/${slug.join('/')}`)) return false;
  return (await headers()).get(RESOLUTION_HEADER) === 'gone';
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = productSlug(slug);
  if (product) return productMetadata({ params: Promise.resolve({ locale, slug: product }) });
  const t = translator(locale);
  return { title: (await isGone(locale, slug)) ? t('catalogGoneTitle') : t('notFoundTitle'), robots: { index: false } };
}

export default async function UnmatchedPage({ params, searchParams }: { params: Params; searchParams?: SearchParams }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const product = productSlug(slug);
  if (product) return ProductPage({ params: Promise.resolve({ locale, slug: product }), searchParams: searchParams ?? Promise.resolve({}) });

  if (await isGone(locale, slug)) {
    const t = translator(locale);
    return <MessageBlock title={t('catalogGoneTitle')} text={t('catalogGoneText')} cta={{ href: routes.home(locale), label: t('backHome') }} />;
  }
  notFound();
}
