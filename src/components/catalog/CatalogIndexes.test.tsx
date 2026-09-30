/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveTarget } from '@/lib/routing';
import { brandsFixture, categoriesFixture } from '@/test/fixtures';
import { BrandGrid } from './BrandGrid';
import { CategoryTree } from './CategoryTree';

describe('CategoryTree', () => {
  it.each(['en', 'ar'] as const)('draws every category with its groups and sub-categories, linked by Target (%s)', (locale) => {
    const tree = categoriesFixture(locale);
    const { container } = render(<CategoryTree items={tree.items} locale={locale} />);

    expect(screen.getAllByTestId('category')).toHaveLength(tree.items.length);
    const hrefs = new Set([...container.querySelectorAll('a')].map((a) => a.getAttribute('href')));
    const walk = (nodes: typeof tree.items): void => nodes.forEach((node) => (expect(hrefs.has(resolveTarget(node.target, locale)!.href)).toBe(true), walk(node.children)));
    walk(tree.items);
    const first = tree.items[0];
    expect(within(screen.getAllByTestId('category')[0]).getAllByText(first.name)[0]).toBeInTheDocument();
  });
});

describe('BrandGrid', () => {
  it.each(['en', 'ar'] as const)('draws brand tiles linking to their pages (%s)', (locale) => {
    const brands = brandsFixture(locale);
    render(<BrandGrid items={brands.items} locale={locale} />);
    const links = within(screen.getByTestId('brand-grid')).getAllByRole('link');
    expect(links).toHaveLength(brands.items.length);
    expect(links[0]).toHaveAttribute('href', resolveTarget(brands.items[0].target, locale)!.href);
    expect(links[0]).toHaveTextContent(brands.items[0].name);
  });
});
