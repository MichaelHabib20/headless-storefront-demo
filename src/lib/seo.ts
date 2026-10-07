import type { Metadata } from 'next';
import { createElement, Fragment } from 'react';
import type { Locale, Seo } from '@/sdk';
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
  const languages: Record<string, string> = {};
  for (const alternate of seo.alternates) {
    const link = resolveTarget(alternate.target, alternate.locale);
    if (link && !link.external) languages[alternate.locale] = link.href;
  }
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
export function SeoLinks({ seo, locale }: { seo: Seo; locale: Locale }) {
  const { prev, next } = paginationHrefs(seo, locale);
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
