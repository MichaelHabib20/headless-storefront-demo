'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import type { Locale } from '@/sdk';
import { switchLocalePath } from '@/lib/routing';
import { usePageAlternate } from './PageAlternates';

interface LocaleLinkProps {
  /** The page's current language; the link opens the other one. */
  locale: Locale;
  className?: string;
  ariaLabel?: string;
  onClick?: () => void;
  'data-nav'?: string;
  children: ReactNode;
}

/**
 * A link to the same page in the other language, query included (sort, page, filters), like the
 * old storefront. A page with localized slugs (product, category, brand, CMS) gives its address in
 * the other language through <PageAlternates>; other pages just swap the locale segment. The query is read with useSearchParams, so it sits in a Suspense boundary: on a
 * statically rendered page the link starts without the query and gets it in the browser.
 */
export function LocaleLink(props: LocaleLinkProps) {
  return (
    <Suspense fallback={<SwitchLink {...props} search="" />}>
      <WithQuery {...props} />
    </Suspense>
  );
}

function WithQuery(props: LocaleLinkProps) {
  const search = useSearchParams();
  return <SwitchLink {...props} search={search?.toString() ?? ''} />;
}

function SwitchLink({ locale, className, ariaLabel, onClick, 'data-nav': nav, children, search }: LocaleLinkProps & { search: string }) {
  const pathname = usePathname() ?? `/${locale}`;
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  // a page with its own slug in each language says where it is in the other one (PageAlternates)
  const alternate = usePageAlternate(other);
  return (
    <Link href={switchLocalePath(pathname, other, search, alternate)} className={className} hrefLang={other} lang={other} aria-label={ariaLabel} onClick={onClick} data-nav={nav} prefetch={false}>
      {children}
    </Link>
  );
}

interface LanguageSwitchProps {
  locale: Locale;
  label: string;
  ariaLabel: string;
  className?: string;
}

/** Same page in the other language. */
export function LanguageSwitch({ locale, label, ariaLabel, className }: LanguageSwitchProps) {
  return (
    <LocaleLink locale={locale} className={className} ariaLabel={ariaLabel}>
      {label}
    </LocaleLink>
  );
}
