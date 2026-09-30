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

/** The search text of the page (`?q=`); none = all products. */
function searchText(params: PageParams): string {
  const q = params.q;
  return (Array.isArray(q) ? q[0] : q) ?? '';
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  return isLocale(locale) ? listingMetadata(locale, { q: searchText(query) }, query) : {};
}

/** Search results for `?q=`, or all products without it. Filter links keep `q`. */
export default async function SearchPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const q = searchText(query);
  return <ListingPage locale={locale} scope={{ q }} params={query} links={{ path: routes.search(locale), keep: q ? { q } : {} }} />;
}
