import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<PageParams>;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, slug } = await params;
  return isLocale(locale) ? listingMetadata(locale, { tag: slug }, await searchParams) : {};
}

/** Products with one tag. */
export default async function TagPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return <ListingPage locale={locale} scope={{ tag: slug }} params={await searchParams} links={{ path: routes.tag(locale, slug) }} />;
}
