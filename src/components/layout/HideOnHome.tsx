'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Locale } from '@/sdk';
import { routes } from '@/lib/routing';

/** Draws `children` on every page except the home page. */
export function HideOnHome({ locale, children }: { locale: Locale; children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const home = routes.home(locale);
  if (pathname.replace(/\/$/, '') === home.replace(/\/$/, '')) return null;
  return <>{children}</>;
}
