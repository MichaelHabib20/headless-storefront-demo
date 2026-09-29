import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getWishlist, isApiError, isLocale, type Locale } from '@/sdk';
import { pageHref, positiveIntParam } from '@/components/ui/Pagination';
import { WishlistView, type WishlistState } from '@/components/wishlist/WishlistView';
import { translator } from '@/lib/i18n';
import { routes } from '@/lib/routing';
import { shopperContext } from '@/lib/shopper.server';
import { loadLayout, storefrontClient } from '@/lib/storefront.server';
import { moveWishlistItemToCartAction, removeFromWishlistAction } from './actions';

export const dynamic = 'force-dynamic';

const PER_PAGE = 12;
/** The contract's maximum page size. */
const MAX_PER_PAGE = 50;

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? translator(locale)('wishlistTitle') : undefined, robots: { index: false } };
}

/** The store can switch the wishlist off; then the page doesn't exist. */
async function wishlistEnabled(locale: Locale): Promise<boolean> {
  try {
    return (await loadLayout(locale)).features.wishlist;
  } catch {
    return true; // the layout shows "store unavailable" on its own
  }
}

async function loadWishlist(locale: Locale, page: number, perPage: number): Promise<WishlistState> {
  // Rendering never creates a guest: without a token there is nothing saved yet.
  const ctx = await shopperContext(locale);
  if (!ctx.token) return { status: 'guest' };
  try {
    return { status: 'ok', wishlist: await getWishlist(storefrontClient(), ctx, { page, perPage }) };
  } catch (error) {
    if (isApiError(error) && error.kind === 'unauthenticated') return { status: 'guest' };
    console.error('wishlist failed to load', error);
    return { status: 'error' };
  }
}

export default async function WishlistPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { locale } = await params;
  if (!isLocale(locale) || !(await wishlistEnabled(locale))) notFound();

  const query = await searchParams;
  const page = positiveIntParam(query.page, 1);
  const perPage = positiveIntParam(query.perPage, PER_PAGE, MAX_PER_PAGE);
  const pageQuery = { perPage: perPage === PER_PAGE ? undefined : perPage };

  const state = await loadWishlist(locale, page, perPage);

  // Past the last page (e.g. the last item of the last page was removed): go to the last page.
  if (state.status === 'ok' && state.wishlist.items.length === 0 && page > 1) {
    const last = Math.max(1, state.wishlist.pagination.totalPages);
    if (last < page) redirect(pageHref(routes.wishlist(locale), last, pageQuery));
  }

  return (
    <WishlistView
      state={state}
      locale={locale}
      pageQuery={pageQuery}
      onRemove={removeFromWishlistAction}
      onMoveToCart={moveWishlistItemToCartAction}
    />
  );
}
