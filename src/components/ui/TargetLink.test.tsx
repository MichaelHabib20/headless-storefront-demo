/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TargetLink } from './TargetLink';

describe('TargetLink', () => {
  it('renders internal targets as locale links', () => {
    render(<TargetLink target={{ type: 'brand', slug: 'bioderma' }} locale="ar">Bioderma</TargetLink>);
    expect(screen.getByRole('link', { name: 'Bioderma' })).toHaveAttribute('href', '/ar/product/brand/bioderma');
  });

  it('opens external targets safely in a new tab', () => {
    render(<TargetLink target={{ type: 'url', url: 'https://cdn.test/mag.pdf' }} locale="en">Magazine</TargetLink>);
    const link = screen.getByRole('link', { name: 'Magazine' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders non-clickable content for null targets', () => {
    render(<TargetLink target={null} locale="en">Plain</TargetLink>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Plain')).toBeInTheDocument();
  });
});
