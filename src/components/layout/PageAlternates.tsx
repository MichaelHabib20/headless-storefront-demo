'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';
import type { Locale } from '@/sdk';

/** The current page's own address in each language (its hreflang alternates), for the language switch. */
export type AlternateHrefs = Partial<Record<Locale, string>>;

interface Entry {
  /** The pathname these alternates belong to: a switch on another page never uses them. */
  path: string;
  hrefs: AlternateHrefs;
}

let current: Entry | null = null;
const listeners = new Set<() => void>();

function publish(entry: Entry | null) {
  current = entry;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tells the language switch (in the layout, which cannot see the page's data) where this page is in
 * the other language: a product, category, brand or CMS page has its own slug in each language
 * (/ar/شان-… is /en/shaan-…), so swapping the locale in the path is not enough. Rendered by the
 * page with the hrefs of its `Seo.alternates`; it renders nothing. Set after hydration and after
 * every client-side navigation, cleared when the page goes away.
 */
export function PageAlternates({ hrefs }: { hrefs: AlternateHrefs }) {
  const path = usePathname() ?? '';
  const key = JSON.stringify(hrefs);
  useEffect(() => {
    const entry: Entry = { path, hrefs: JSON.parse(key) as AlternateHrefs };
    publish(entry);
    return () => {
      if (current === entry) publish(null);
    };
  }, [path, key]);
  return null;
}

/** The current page's address in `locale` when the page gave one (PageAlternates), else null. */
export function usePageAlternate(locale: Locale): string | null {
  const pathname = usePathname() ?? '';
  const entry = useSyncExternalStore(subscribe, () => current, () => null);
  return entry && entry.path === pathname ? (entry.hrefs[locale] ?? null) : null;
}
