/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Section, SectionLayout } from '@/sdk';
import { homeBlocksFixture, homeFixture } from '@/test/fixtures';
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

  it('draws by the design when the storefront knows it, over the layout', () => {
    const base = homeFixture('en').sections.find((s) => s.banners.length > 1)!;
    render(<HomeSection section={{ ...base, layout: 'banner_grid', design: 'single_banner' }} locale="en" />);
    const node = screen.getByTestId('home-section');
    expect(node).toHaveAttribute('data-design', 'single_banner');
    expect(node).toHaveAttribute('data-layout', 'banner_grid');
    expect(node.querySelectorAll('picture')).toHaveLength(1);
  });

  it.each([['an unknown', 'not_built_here'], ['no', null], ['a missing', undefined]] as const)(
    'with %s design it draws by the layout, exactly as before designs',
    (_, design) => {
      const base = homeFixture('en').sections.find((s) => s.banners.length > 1)!;
      const { container: before, unmount } = render(<HomeSection section={{ ...base, layout: 'single_banner' }} locale="en" />);
      const html = before.innerHTML;
      unmount();
      render(<HomeSection section={{ ...base, layout: 'single_banner', design }} locale="en" />);
      const node = screen.getByTestId('home-section');
      expect(node).not.toHaveAttribute('data-design');
      expect(node.querySelectorAll('picture')).toHaveLength(1);
      expect(node.parentElement!.innerHTML).toBe(html);
    },
  );

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

  describe('with blocks', () => {
    it.each([['null', null], ['an empty tree', { version: 1, blocks: [] }]] as const)(
      'blocks %s: drawn exactly as a section without the field',
      (_, blocks) => {
        for (const locale of ['en', 'ar'] as const) {
          for (const section of homeFixture(locale).sections) {
            const { container, unmount } = render(<HomeSection section={section} locale={locale} priority />);
            const html = container.innerHTML;
            unmount();
            const { container: withField, unmount: done } = render(<HomeSection section={{ ...section, blocks: blocks as Section['blocks'] }} locale={locale} priority />);
            expect(withField.innerHTML).toBe(html);
            expect(withField.querySelector('[data-blocks]')).toBeNull();
            done();
          }
        }
      },
    );

    it('draws the blocks instead of the banners and the product row, under the same heading', () => {
      const section = homeBlocksFixture('en').sections[1];
      render(<HomeSection section={section} locale="en" />);
      const node = screen.getByTestId('home-section');
      expect(node).toHaveAttribute('data-blocks');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(section.title!);
      expect(screen.getByRole('link', { name: 'View all' })).toBeInTheDocument();
      expect(within(node).getByTestId('section-blocks')).toBeInTheDocument();
      // grid of 3 images + a text + the products as a rail (limit 4 of the section's 10)
      expect(Array.from(within(node).getByTestId('section-blocks').children, (c) => c.getAttribute('data-block'))).toEqual(['grid', 'text', 'product_list']);
      expect(node.querySelectorAll('[data-block="grid"] picture')).toHaveLength(3);
      expect(within(node).getAllByTestId('product-card')).toHaveLength(4);
    });

    it('renders every section of the blocks fixture, in English and Arabic', () => {
      for (const locale of ['en', 'ar'] as const) {
        for (const section of homeBlocksFixture(locale).sections) {
          const { unmount } = render(<HomeSection section={section} locale={locale} />);
          const node = screen.getByTestId('home-section');
          expect(node).toHaveAttribute('data-blocks');
          // every link has a name, and target-null images/buttons are not links
          for (const link of node.querySelectorAll('a')) expect(link.textContent?.trim() || link.querySelector('img')?.getAttribute('alt')?.trim()).toBeTruthy();
          unmount();
        }
      }
    });

    it('the Arabic page shows the Arabic texts and artwork', () => {
      const section = homeBlocksFixture('ar').sections[0];
      render(<HomeSection section={section} locale="ar" />);
      // untitled section: its heading block is the h2
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('كل ما يحتاجه طفلك');
      expect(screen.getByRole('link', { name: 'تسوق منتجات الأطفال' })).toHaveAttribute('href', expect.stringMatching(/^\/ar\//));
      expect(screen.queryByRole('link', { name: 'كل العروض' })).toBeNull(); // its target was deleted
      const first = screen.getByTestId('home-section').querySelector('picture')!;
      expect(first.querySelector('img')?.getAttribute('src')).toMatch(/-ar\.\w+$/);
    });

    it('a design with no block styles of its own draws blocks the default way', () => {
      const section = homeBlocksFixture('en').sections[1];
      const { container, unmount } = render(<HomeSection section={section} locale="en" />);
      const html = container.querySelector('[data-testid="section-blocks"]')!.outerHTML;
      unmount();
      render(<HomeSection section={{ ...section, design: 'banner_grid' }} locale="en" />);
      expect(screen.getByTestId('home-section')).toHaveAttribute('data-design', 'banner_grid');
      expect(screen.getByTestId('section-blocks').outerHTML).toBe(html);
    });
  });
});
