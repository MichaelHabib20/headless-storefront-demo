'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/sdk';
import { switchLocalePath } from '@/lib/routing';

interface LanguageSwitchProps {
  locale: Locale;
  label: string;
  ariaLabel: string;
  className?: string;
}

/** Same page in the other language. */
export function LanguageSwitch({ locale, label, ariaLabel, className }: LanguageSwitchProps) {
  const pathname = usePathname() ?? `/${locale}`;
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  return (
    <Link href={switchLocalePath(pathname, other)} className={className} hrefLang={other} lang={other} aria-label={ariaLabel} prefetch={false}>
      {label}
    </Link>
  );
}
