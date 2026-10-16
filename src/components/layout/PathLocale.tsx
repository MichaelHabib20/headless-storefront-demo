'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/sdk';

/** The page language from a path's first segment (`/ar/...` → `ar`); anything else is English. */
export function localeOfPath(pathname: string | null | undefined): Locale {
  return pathname?.split('/')[1] === 'ar' ? 'ar' : 'en';
}

/**
 * Shows the version of `children` in the language of the current URL. For pages that cannot read
 * the route's params (`not-found`): the server renders every language, only the URL's one is drawn.
 */
export function PathLocale({ versions }: { versions: Record<Locale, ReactNode> }) {
  return <>{versions[localeOfPath(usePathname())]}</>;
}
