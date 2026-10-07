import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; key: string }>;
type SearchParams = Promise<PageParams>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, key } = await params;
  return isLocale(locale) ? listingMetadata(locale, { list: key }, await searchParams) : {};
}

/** A merchant's product list, by its slug (or its id when it has no slug). */
export default async function ListPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, key } = await params;
  if (!isLocale(locale)) notFound();
  return <ListingPage locale={locale} scope={{ list: key }} params={await searchParams} links={{ path: routes.list(locale, key) }} />;
}
