import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { TrackEvent } from '@/components/marketing/TrackEvent';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<PageParams>;

/**
 * The old storefront's parameters that say WHAT `/products` lists (menus with id links, banners,
 * bookmarks): the backend reads them (GET /products), and filter links keep them.
 */
const SCOPE_PARAMS = ['category_id', 'sub_category_id', 'group_id', 'list_ids', 'vendor_ids', 'promotions'] as const;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

/** The search text of the page (`?search=`, the old storefront's name, or `?q=`); none = all products. */
function searchText(params: PageParams): string {
  return first(params.search) || first(params.q);
}

/** The parameters every link of the page keeps: the search text and the old scope parameters. */
function kept(params: PageParams): Record<string, string> {
  const keep: Record<string, string> = {};
  const q = searchText(params);
  if (q) keep.search = q;
  for (const name of SCOPE_PARAMS) {
    const value = first(params[name]);
    if (value) keep[name] = value;
  }
  return keep;
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale } = await params;
  const query = await searchParams;
  return isLocale(locale) ? listingMetadata(locale, { q: searchText(query) }, query) : {};
}

/**
 * `/products`: search results for `?search=` (or `?q=`), a listing the old storefront's id
 * parameters pick (`?category_id=`, `?list_ids=`...), or all products. Filter links keep them.
 */
export default async function SearchPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams;
  const q = searchText(query);
  return (
    <>
      {q && <TrackEvent locale={locale} event={{ name: 'search', searchTerm: q }} />}
      <ListingPage locale={locale} scope={{ q }} params={query} links={{ path: routes.search(locale), keep: kept(query) }} />
    </>
  );
}
