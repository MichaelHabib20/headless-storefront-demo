import type { Metadata } from 'next';
import type { Locale, Seo } from '@/sdk';
import { resolveTarget } from './routing';

/**
 * Page metadata from the backend's `Seo` block. The backend decides the title, description,
 * what the canonical page is and whether to index; this only turns its Targets into our URLs.
 */
export function seoMetadata(seo: Seo, locale: Locale): Metadata {
  const canonical = resolveTarget(seo.canonical, locale)?.href;
  const languages: Record<string, string> = {};
  for (const alternate of seo.alternates) {
    const link = resolveTarget(alternate.target, alternate.locale);
    if (link && !link.external) languages[alternate.locale] = link.href;
  }

  return {
    title: seo.title,
    description: seo.description ?? undefined,
    alternates: { canonical, languages: Object.keys(languages).length ? languages : undefined },
    robots: seo.index ? undefined : { index: false, follow: true },
  };
}
