import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Locale, Target } from '@/sdk';
import { resolveTarget } from '@/lib/routing';

interface TargetLinkProps {
  target: Target | null | undefined;
  locale: Locale;
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

/**
 * The only way to render a link to something the backend returned. A null or
 * unknown target renders its content without a link.
 */
export function TargetLink({ target, locale, children, className, ...aria }: TargetLinkProps) {
  const link = resolveTarget(target, locale);
  if (!link) {
    return <span className={className}>{children}</span>;
  }
  if (link.external) {
    return (
      <a href={link.href} className={className} target="_blank" rel="noopener noreferrer" {...aria}>
        {children}
      </a>
    );
  }
  return (
    <Link href={link.href} className={className} {...aria}>
      {children}
    </Link>
  );
}
