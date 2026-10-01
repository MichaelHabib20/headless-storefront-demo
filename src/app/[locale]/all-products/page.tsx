import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<PageParams>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? listingMetadata(locale, { q: '' }, await searchParams) : {};
}

/**
 * Every product (the old storefront's /all-products): the listing with no scope. Its title,
 * filters, sort and canonical (`{type: search, query: ""}` → this page) come from the backend.
 */
export default async function AllProductsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ListingPage locale={locale} scope={{ q: '' }} params={await searchParams} links={{ path: routes.allProducts(locale) }} />;
}
