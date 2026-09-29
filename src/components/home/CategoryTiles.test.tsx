/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { homeFixture } from '@/test/fixtures';
import { CategoryTiles } from './CategoryTiles';

describe('CategoryTiles', () => {
  it.each([
    ['en', 'Shop by category', 'Find what you need, fast'],
    ['ar', 'تسوق حسب الفئة', 'اعثر على ما تحتاجه بسرعة'],
  ] as const)('shows the heading and subtitle in %s', (locale, heading, subtitle) => {
    const { container } = render(<CategoryTiles tiles={homeFixture(locale).featuredCategories} locale={locale} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(heading);
    expect(container.querySelector('h2 + p')).toHaveTextContent(subtitle);
  });
});
