import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type ListingScope, type Locale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; path: string[] }>;
type SearchParams = Promise<PageParams>;

/** Next hands dynamic segments over percent-encoded (`%D8%A7…` for an Arabic slug). */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * The old storefront's `/product/...` listings:
 * - `/product/{cat}[/{group}][/{sub}]` a category, group or sub-category (Arabic slugs on /ar);
 * - `/product/{cat}/brand/{brand}` a category with one brand picked;
 * - `/product/deals/{cat}` the deals (the old category chips on the deals page).
 */
function listing(locale: Locale, raw: string[], params: PageParams): { scope: ListingScope; params: PageParams; path: string } {
  const path = raw.map(decode);
  if (path[0] === 'deals') return { scope: { deals: true }, params, path: routes.deals(locale) };
  if (path.length === 3 && path[1] === 'brand') {
    const withBrand = params.brands ? params : { ...params, brands: path[2] };
    return { scope: { category: [path[0]] }, params: withBrand, path: `/${locale}/product/${raw.join('/')}` };
  }
  return { scope: { category: path }, params, path: routes.category(locale, path) };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, path } = await params;
  if (!isLocale(locale)) return {};
  const page = listing(locale, path, await searchParams);
  return listingMetadata(locale, page.scope, page.params);
}

/** `/product/skin-care/face-care` → `category=skin-care/face-care`. */
export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  const page = listing(locale, path, await searchParams);
  return <ListingPage locale={locale} scope={page.scope} params={page.params} links={{ path: page.path }} />;
}
