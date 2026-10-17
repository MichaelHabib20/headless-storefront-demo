import type { Metadata } from 'next';
import { createElement, Fragment } from 'react';
import { LOCALES, type Locale, type Seo } from '@/sdk';
import { listingPageHref } from './listing';
import { resolveTarget } from './routing';

/**
 * Page metadata from the backend's `Seo` block. The backend decides the title (the whole title:
 * the layout's "| store" template is not added again), the description, the canonical page, the
 * languages, whether to index and the social preview; this only turns its Targets into our URLs.
 * Members of `openGraph` that are null fall back to the title / description (the store logo comes
 * from the backend's home `Seo`).
 */
export function seoMetadata(seo: Seo, locale: Locale): Metadata {
  const canonical = resolveTarget(seo.canonical, locale)?.href;
  const languages: Record<string, string> = { ...alternateHrefs(seo) };
  // x-default: the Arabic page, like the old storefront
  if (languages.ar) languages['x-default'] = languages.ar;

  const meta: Metadata = {
    title: { absolute: seo.title },
    description: seo.description ?? undefined,
    alternates: { canonical, languages: Object.keys(languages).length ? languages : undefined },
    robots: seo.index ? undefined : { index: false, follow: true },
  };

  const og = seo.openGraph;
  if (og) {
    const title = og.title ?? seo.title;
    const description = og.description ?? seo.description ?? undefined;
    const images = og.image ? [og.image] : undefined;
    // og:type of the preview (not a Target type). Next.js has no "product": SeoLinks writes that one.
    const { type: previewType } = og;
    meta.openGraph = { title, description, images, url: canonical, locale: locale === 'ar' ? 'ar_EG' : 'en_US', ...(previewType === 'product' ? {} : { type: previewType }) };
    meta.twitter = { card: images ? 'summary_large_image' : 'summary', title, description, images };
  }
  return meta;
}

/**
 * The page's address in each language, from `Seo.alternates` (our URLs; external ones left out):
 * the hreflang links and the language switch (<PageAlternates>) both use it.
 */
export function alternateHrefs(seo: Seo): Partial<Record<Locale, string>> {
  const hrefs: Partial<Record<Locale, string>> = {};
  for (const alternate of seo.alternates) {
    const link = resolveTarget(alternate.target, alternate.locale);
    if (link && !link.external) hrefs[alternate.locale] = link.href;
  }
  return hrefs;
}

/**
 * The `Seo` of a content page (CMS page, contact, branches, merchant form) with the old storefront's
 * title rule: the merchant's own SEO title stays as it is; without one the backend's title is the
 * page name, and the old storefront wrote "<page name> - <store name>" (static-page.component.ts).
 * `pageTitle` is the page's name from the API, `storeName` is `Layout.store.name`.
 */
export function contentPageSeo(seo: Seo, pageTitle: string | null | undefined, storeName: string | null | undefined): Seo {
  if (!storeName || !pageTitle || seo.title !== pageTitle || seo.title === storeName) return seo;
  return { ...seo, title: pageTitleWithStore(seo.title, storeName) };
}

/** "<page> - <store>": the old storefront's title of its own pages (sign in, cart, CMS pages...). */
export function pageTitleWithStore(title: string, storeName: string): string {
  return `${title} - ${storeName}`;
}

/** The layout's title template for pages that set a plain `title` (ours): "<page> - <store>". */
export function titleTemplate(storeName: string): string {
  return pageTitleWithStore('%s', storeName);
}

/**
 * Canonical and hreflang of a page of ours that has no backend `Seo` and the same address in every
 * language (the brands and categories indexes): itself, each language, x-default the Arabic page
 * (like the old storefront and `seoMetadata`). `href` builds the page's URL in a language.
 */
export function ownPageAlternates(href: (locale: Locale) => string, locale: Locale): NonNullable<Metadata['alternates']> {
  const languages: Record<string, string> = Object.fromEntries(LOCALES.map((each) => [each, href(each)]));
  languages['x-default'] = href('ar');
  return { canonical: href(locale), languages };
}

/** rel=prev / rel=next of a paginated page: the canonical page with `page` (page 1 has none). */
export function paginationHrefs(seo: Seo, locale: Locale): { prev: string | null; next: string | null } {
  const canonical = resolveTarget(seo.canonical, locale);
  if (!seo.pagination || !canonical || canonical.external) return { prev: null, next: null };
  const [path, query = ''] = canonical.href.split('?');
  const href = (page: number | null) => (page ? listingPageHref(path, query, page) : null);
  return { prev: href(seo.pagination.prev), next: href(seo.pagination.next) };
}

/**
 * Head tags Next.js metadata cannot write: `<link rel="prev|next">` and `og:type=product`.
 * React hoists them into <head>. Rendered by <JsonLd> (src/lib/jsonld.ts).
 */
export function SeoLinks({ seo, locale, origin = '' }: { seo: Seo; locale: Locale; /** the public origin: absolute links like the canonical's */ origin?: string }) {
  const hrefs = paginationHrefs(seo, locale);
  const prev = hrefs.prev && origin + hrefs.prev;
  const next = hrefs.next && origin + hrefs.next;
  // og:type of the preview (not a Target type)
  const previewType = seo.openGraph ? seo.openGraph['type'] : null;
  return createElement(
    Fragment,
    null,
    prev ? createElement('link', { rel: 'prev', href: prev }) : null,
    next ? createElement('link', { rel: 'next', href: next }) : null,
    previewType === 'product' ? createElement('meta', { property: 'og:type', content: 'product' }) : null,
  );
}
