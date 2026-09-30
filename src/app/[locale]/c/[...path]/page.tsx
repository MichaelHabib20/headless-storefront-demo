import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; path: string[] }>;
type SearchParams = Promise<PageParams>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, path } = await params;
  return isLocale(locale) ? listingMetadata(locale, { category: path }, await searchParams) : {};
}

/** A category, group or sub-category: `/c/skin-care/face-care` → `category=skin-care/face-care`. */
export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, path } = await params;
  if (!isLocale(locale)) notFound();
  return <ListingPage locale={locale} scope={{ category: path }} params={await searchParams} links={{ path: routes.category(locale, path) }} />;
}
