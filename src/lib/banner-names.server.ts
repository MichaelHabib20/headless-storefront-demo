import 'server-only';
import { getProduct, type Locale, type ResponsiveImage, type Target } from '@/sdk';
import { loadListing } from './catalog.server';
import { loadForm, loadLandingPage, loadPage } from './content.server';
import { targetPage } from './routing';
import { shopperContext } from './shopper.server';
import { storefrontClient } from './storefront.server';

/** A banner whose image is a link's only content (section banners, promo strips, popups). */
interface NamedImage {
  image: ResponsiveImage;
  title: string | null;
  target: Target | null;
}

/** The merchant's alt text, else the banner's / ad's name from the API; null when it has neither. */
export function ownBannerName(banner: NamedImage): string | null {
  return banner.image.alt?.trim() || banner.title?.trim() || null;
}

/**
 * The title of the page a banner opens, in the page's language: the form's, CMS page's or landing
 * page's title, the product's name, the listing's title. Null when the API has none or fails (the
 * banner then gets the generic "Banner" label). Each one is read once per request (cached loaders).
 */
export async function targetTitle(target: Target | null, locale: Locale): Promise<string | null> {
  const opens = targetPage(target);
  if (!opens) return null;
  try {
    if (opens.kind === 'listing') {
      const result = await loadListing(locale, opens.scope, {});
      return result.status === 'ok' ? result.listing.context.title?.trim() || null : null;
    }
    if (opens.kind === 'product') {
      const details = await getProduct(storefrontClient(), await shopperContext(locale), opens.slug);
      return details.product.name.trim() || null;
    }
    if (opens.kind === 'form') {
      const result = await loadForm(locale, opens.slug);
      return result.status === 'ok' ? result.data.title?.trim() || null : null;
    }
    if (opens.kind === 'page') {
      const result = await loadPage(locale, opens.slug);
      return result.status === 'ok' ? result.data.title?.trim() || null : null;
    }
    const result = await loadLandingPage(locale, opens.slug);
    return result.status === 'ok' ? (result.data.title ?? result.data.seo.title)?.trim() || null : null;
  } catch {
    return null;
  }
}

/**
 * Banners whose link would have no accessible name (no alt text, no name from the API) get the title
 * of the page they open as their alt text; the components add the generic "Banner" label for the rest.
 */
export async function withBannerNames<T extends NamedImage>(banners: readonly T[], locale: Locale): Promise<T[]> {
  return Promise.all(
    banners.map(async (banner) => {
      if (ownBannerName(banner)) return banner;
      const title = await targetTitle(banner.target, locale);
      return title ? { ...banner, image: { ...banner.image, alt: title } } : banner;
    }),
  );
}
