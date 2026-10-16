/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/en/nope' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

import NotFound from '@/app/[locale]/not-found';
import { localeOfPath } from './PathLocale';

describe('not-found page', () => {
  it('reads the language from the path', () => {
    expect(localeOfPath('/ar/x/y')).toBe('ar');
    expect(localeOfPath('/en')).toBe('en');
    expect(localeOfPath(null)).toBe('en');
  });

  it('shows English only on an English URL', () => {
    pathname.value = '/en/this-page-does-not-exist';
    const { container } = render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
    expect(container.textContent).not.toMatch(/[؀-ۿ]/);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/en');
  });

  it('shows Arabic only on an Arabic URL', () => {
    pathname.value = '/ar/this-page-does-not-exist';
    const { container } = render(<NotFound />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('الصفحة غير موجودة');
    expect(container.textContent).not.toMatch(/[A-Za-z]/);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ar');
  });
});
