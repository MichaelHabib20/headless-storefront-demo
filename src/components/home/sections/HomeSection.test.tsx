/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Section, SectionLayout } from '@/sdk';
import { homeFixture } from '@/test/fixtures';
import { HomeSection } from './HomeSection';

describe('HomeSection', () => {
  it('renders every recorded staging section', () => {
    for (const locale of ['en', 'ar'] as const) {
      for (const section of homeFixture(locale).sections) {
        const { unmount } = render(<HomeSection section={section} locale={locale} />);
        const node = screen.getByTestId('home-section');
        expect(node.querySelectorAll('img').length).toBeGreaterThanOrEqual(section.banners.length);
        expect(within(node).queryAllByTestId('product-card')).toHaveLength(section.products.length);
        unmount();
      }
    }
  });

  it('shows the title and the view-all link from the backend', () => {
    const babyCare = homeFixture('en').sections.find((s) => s.products.length > 0)!;
    render(<HomeSection section={babyCare} locale="en" />);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(babyCare.title!);
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', expect.stringMatching(/^\/en\/products\/list\//));
  });

  it('has no heading when the merchant hid the title', () => {
    const untitled = homeFixture('en').sections.find((s) => s.title === null)!;
    render(<HomeSection section={untitled} locale="en" />);
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it.each<SectionLayout>(['products_only', 'single_banner', 'banner_carousel', 'wide_banner', 'banner_grid', 'banner_rows'])(
    'draws the %s layout',
    (layout) => {
      const section: Section = { ...homeFixture('en').sections.find((s) => s.banners.length > 1)!, layout };
      render(<HomeSection section={section} locale="en" />);
      const node = screen.getByTestId('home-section');
      expect(node).toHaveAttribute('data-layout', layout);
      const expected = layout === 'products_only' ? 0 : layout === 'single_banner' ? 1 : section.banners.length;
      expect(node.querySelectorAll('picture')).toHaveLength(expected);
    },
  );

  it('falls back to a grid for layouts added to the API later', () => {
    const section = { ...homeFixture('en').sections[1], layout: 'hero_video' } as unknown as Section;
    render(<HomeSection section={section} locale="en" />);
    expect(screen.getByTestId('home-section')).toHaveAttribute('data-layout', 'banner_grid');
  });

  it.each<SectionLayout>(['single_banner', 'banner_carousel', 'wide_banner', 'banner_grid', 'banner_rows'])(
    'every image link of the %s layout has a name: alt, else the banner name, else "Banner" (EN + AR)',
    (layout) => {
      for (const [locale, generic] of [['en', 'Banner'], ['ar', 'بانر إعلاني']] as const) {
        const base = homeFixture(locale).sections.find((s) => s.banners.length > 1)!;
        const banners = [
          { ...base.banners[0], image: { ...base.banners[0].image, alt: 'Merchant alt' }, title: 'Name' },
          { ...base.banners[1], image: { ...base.banners[1].image, alt: '' }, title: 'Ad name' },
          { ...base.banners[1], id: 999, image: { ...base.banners[1].image, alt: ' ' }, title: null },
        ];
        const { unmount } = render(<HomeSection section={{ ...base, layout, banners, products: [] }} locale={locale} />);
        const names = Array.from(screen.getByTestId('home-section').querySelectorAll('a img'), (img) => img.getAttribute('alt'));
        expect(names).toEqual(layout === 'single_banner' ? ['Merchant alt'] : ['Merchant alt', 'Ad name', generic]);
        unmount();
      }
    },
  );

  it('the recorded wide banner to the prescriptions form is never an unnamed link', () => {
    const wide = homeFixture('ar').sections.find((s) => s.layout === 'wide_banner')!;
    render(<HomeSection section={wide} locale="ar" />);
    for (const link of screen.getByTestId('home-section').querySelectorAll('a')) {
      expect(link.querySelector('img')?.getAttribute('alt')?.trim()).toBeTruthy();
    }
  });
});
