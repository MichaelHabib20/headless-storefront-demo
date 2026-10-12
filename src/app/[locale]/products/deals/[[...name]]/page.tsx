import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isLocale, type ListingScope } from '@/sdk';
import { ListingPage } from '@/components/catalog/ListingPage';
import { listingMetadata } from '@/lib/catalog.server';
import type { PageParams } from '@/lib/listing';
import { routes } from '@/lib/routing';

export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; name?: string[] }>;
type SearchParams = Promise<PageParams>;

/** Next hands dynamic segments over percent-encoded (`%D8%A7…` for an Arabic slug). */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** `/products/deals` all deals; the old `/products/deals/{name}` the deals of the category `name`. */
function dealsScope(name: string[] | undefined): { scope: ListingScope; name: string | null } {
  const category = name?.[0] ? decode(name[0]) : null;
  return category ? { scope: { deals: true, category: [category] }, name: category } : { scope: { deals: true }, name: null };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { locale, name } = await params;
  return isLocale(locale) ? listingMetadata(locale, dealsScope(name).scope, await searchParams) : {};
}

/** The products the backend counts as deals, all or of one category. */
export default async function DealsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale, name } = await params;
  if (!isLocale(locale)) notFound();
  const page = dealsScope(name);
  const path = page.name ? routes.dealsByName(locale, page.name) : routes.deals(locale);
  return <ListingPage locale={locale} scope={page.scope} params={await searchParams} links={{ path }} />;
}
