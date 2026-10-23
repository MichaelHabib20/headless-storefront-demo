/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SectionBlockImage, SectionBlockLeaf, Locale, SectionBlock, Target } from '@/sdk';
import { homeFixture } from '@/test/fixtures';
import { BlockRenderer, blockComponents } from './BlockRenderer';

const LIST: Target = { type: 'list', slug: null, id: 125 };
const products = homeFixture('en').sections.find((s) => s.products.length > 0)!.products;

const image = (over: Partial<SectionBlockImage> = {}): SectionBlockImage => ({
  type: 'image',
  media: { desktop: 'https://img.test/d.jpg', mobile: 'https://img.test/m.jpg', desktop_ar: null, mobile_ar: null },
  alt: 'Summer sale',
  target: LIST,
  ...over,
});

function draw(blocks: (SectionBlock | Record<string, unknown>)[], { locale = 'en', titled = true }: { locale?: Locale; titled?: boolean } = {}) {
  return render(<BlockRenderer blocks={blocks as SectionBlock[]} locale={locale} products={products} label="Baby Care" titled={titled} design={null} />);
}

const root = () => screen.getByTestId('section-blocks');

describe('BlockRenderer: leaves', () => {
  it('image with a target: a link named by its alt text, mobile + desktop artwork', () => {
    draw([image()]);
    const link = screen.getByRole('link', { name: 'Summer sale' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^\/en\/products\/list\//));
    const picture = link.querySelector('picture')!;
    expect(picture.querySelector('source')).toHaveAttribute('srcset', 'https://img.test/d.jpg');
    expect(picture.querySelector('img')).toHaveAttribute('src', 'https://img.test/m.jpg');
  });

  it('image linked without alt text is still a named link ("Banner", EN + AR)', () => {
    for (const [locale, name] of [['en', 'Banner'], ['ar', 'بانر إعلاني']] as const) {
      const { unmount } = draw([image({ alt: null })], { locale });
      expect(screen.getByRole('link', { name })).toBeInTheDocument();
      unmount();
    }
  });

  it('image with target null (none, or its page was deleted) is not a link', () => {
    draw([image({ target: null }), image({ target: null, alt: null })]);
    expect(root().querySelectorAll('a')).toHaveLength(0);
    const imgs = root().querySelectorAll('img');
    expect(imgs[0]).toHaveAttribute('alt', 'Summer sale');
    expect(imgs[1]).toHaveAttribute('alt', ''); // decorative, not "Banner"
  });

  it('image on an Arabic page uses the Arabic artwork', () => {
    const media = { desktop: 'https://img.test/d.jpg', mobile: 'https://img.test/m.jpg', desktop_ar: 'https://img.test/d-ar.jpg', mobile_ar: 'https://img.test/m-ar.jpg' };
    draw([image({ media, alt: 'تخفيضات الصيف' })], { locale: 'ar' });
    const link = screen.getByRole('link', { name: 'تخفيضات الصيف' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^\/ar\//));
    expect(link.querySelector('source')).toHaveAttribute('srcset', 'https://img.test/d-ar.jpg');
    expect(link.querySelector('img')).toHaveAttribute('src', 'https://img.test/m-ar.jpg');
  });

  it('text: heading (h3 under a section title, h2 without), body and caption, aligned', () => {
    const texts: SectionBlock[] = [
      { type: 'text', text: 'Big title', style: 'heading', align: 'center' },
      { type: 'text', text: 'Some words', style: 'body' },
      { type: 'text', text: 'Small print', style: 'caption', align: 'end' },
      { type: 'text', text: '   ', style: 'body' },
    ];
    const { unmount } = draw(texts);
    expect(screen.getByRole('heading', { level: 3, name: 'Big title' }).className).toMatch(/align_center/);
    expect(screen.getByText('Some words').tagName).toBe('P');
    expect(screen.getByText('Small print').className).toMatch(/text_caption/);
    expect(root().querySelectorAll('[data-block="text"]')).toHaveLength(3); // the blank one is skipped
    unmount();
    draw(texts, { titled: false });
    expect(screen.getByRole('heading', { level: 2, name: 'Big title' })).toBeInTheDocument();
  });

  it('text in Arabic is shown as sent', () => {
    draw([{ type: 'text', text: 'كل ما يحتاجه طفلك', style: 'heading' }], { locale: 'ar' });
    expect(screen.getByRole('heading', { name: 'كل ما يحتاجه طفلك' })).toBeInTheDocument();
  });

  it('button: a link named by its label; target null → its label, not a link', () => {
    draw([
      { type: 'button', label: 'Shop now', target: LIST, variant: 'primary' },
      { type: 'button', label: 'Gone', target: null, variant: 'secondary' },
      { type: 'button', label: '', target: LIST, variant: 'primary' },
    ]);
    const link = screen.getByRole('link', { name: 'Shop now' });
    expect(link.className).toMatch(/primary/);
    expect(screen.getByText('Gone').tagName).toBe('SPAN');
    expect(screen.queryByRole('link', { name: 'Gone' })).toBeNull();
    expect(root().querySelectorAll('[data-block="button"]')).toHaveLength(2); // no unnamed button
  });

  it('product_list as a rail: the section products, at most the limit, prices by the money components', () => {
    draw([{ type: 'product_list', display: 'rail', limit: 3 }]);
    const list = root().querySelector('[data-block="product_list"]')!;
    expect(list).toHaveAttribute('data-variant', 'rail');
    const cards = within(list as HTMLElement).getAllByTestId('product-card');
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent(products[0].name);
    expect(screen.getByRole('list', { name: 'Baby Care' })).toBeInTheDocument();
  });

  it('product_list as a grid', () => {
    draw([{ type: 'product_list', display: 'grid', limit: 20 }]);
    const list = screen.getByRole('list', { name: 'Baby Care' });
    expect(list).toHaveAttribute('data-variant', 'grid');
    expect(within(list).getAllByTestId('product-card')).toHaveLength(products.length);
  });
});

describe('BlockRenderer: containers', () => {
  it('slider: one rail item per leaf, named, with previous/next buttons', () => {
    draw([{ type: 'slider', autoplay: true, interval_ms: 4000, items: [image(), image({ alt: 'Two' }), image({ alt: 'Three', target: null })] }]);
    const slider = root().querySelector('[data-block="slider"]')!;
    expect(within(slider as HTMLElement).getAllByRole('listitem')).toHaveLength(3);
    expect(within(slider as HTMLElement).getByRole('list', { name: 'Baby Care' })).toBeInTheDocument();
    expect(within(slider as HTMLElement).getByRole('button', { name: 'Previous' })).toBeInTheDocument();
    expect(within(slider as HTMLElement).getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(within(slider as HTMLElement).getAllByRole('link')).toHaveLength(2);
  });

  it('slider buttons are in Arabic on Arabic pages', () => {
    draw([{ type: 'slider', items: [image(), image()] }], { locale: 'ar' });
    expect(screen.getByRole('button', { name: 'السابق' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'التالي' })).toBeInTheDocument();
  });

  it('grid: the merchant columns on phones and desktop, and the gap', () => {
    draw([{ type: 'grid', columns: { mobile: 2, desktop: 4 }, gap: 'l', items: [image(), image(), image(), image()] }]);
    const grid = root().querySelector<HTMLElement>('[data-block="grid"]')!;
    expect(grid.style.getPropertyValue('--columns-mobile')).toBe('2');
    expect(grid.style.getPropertyValue('--columns-desktop')).toBe('4');
    expect(grid.className).toMatch(/gap_l/);
    expect(grid.querySelectorAll('[data-block="image"]')).toHaveLength(4);
  });

  it('row: text, buttons and images side by side, aligned', () => {
    draw([{ type: 'row', align: 'space', items: [{ type: 'text', text: 'Hello', style: 'body' }, { type: 'button', label: 'Go', target: LIST, variant: 'secondary' }, image()] }]);
    const row = root().querySelector('[data-block="row"]')!;
    expect(row.className).toMatch(/row_space/);
    expect(Array.from(row.children, (c) => c.getAttribute('data-block'))).toEqual(['text', 'button', 'image']);
  });

  it('only the first image of the first block loads eagerly', () => {
    render(<BlockRenderer blocks={[{ type: 'grid', columns: { mobile: 1, desktop: 2 }, items: [image(), image()] }, image()]} locale="en" products={products} label="x" titled design={null} priority />);
    expect(Array.from(root().querySelectorAll('img'), (i) => i.getAttribute('loading'))).toEqual(['eager', 'lazy', 'lazy']);
  });
});

describe('BlockRenderer: unknown data is skipped, never guessed', () => {
  it('skips node types it does not know, at the top and inside containers', () => {
    draw([
      { type: 'video', url: 'https://v.test/x.mp4' },
      { type: 'grid', columns: { mobile: 1, desktop: 2 }, items: [{ type: 'countdown', until: '2027-01-01' } as unknown as SectionBlockLeaf, image()] },
      { type: 'text', text: 'Still here', style: 'body' },
      {} as Record<string, unknown>,
      { type: 'constructor' },
    ]);
    expect(Array.from(root().children, (c) => c.getAttribute('data-block'))).toEqual(['grid', 'text']);
    expect(root().querySelectorAll('[data-block="image"]')).toHaveLength(1);
  });

  it('skips a container inside a container (v1 trees are one level deep)', () => {
    draw([{ type: 'row', items: [{ type: 'slider', items: [image()] } as unknown as SectionBlockLeaf, { type: 'text', text: 'Leaf', style: 'body' }] }]);
    expect(root().querySelector('[data-block="slider"]')).toBeNull();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
  });

  it('draws nothing for a container left with nothing to show', () => {
    render(
      <BlockRenderer
        blocks={[{ type: 'slider', items: [{ type: 'text', text: '', style: 'body' }] }, { type: 'product_list', display: 'rail', limit: 5 }]}
        locale="en"
        products={[]}
        label="x"
        titled
        design={null}
      />,
    );
    expect(root().children).toHaveLength(0);
  });

  it('has a component for every block type of the contract', () => {
    expect(Object.keys(blockComponents).sort()).toEqual(['button', 'grid', 'image', 'product_list', 'row', 'slider', 'text']);
  });
});
