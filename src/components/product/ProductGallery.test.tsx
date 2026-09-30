/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Locale, ProductDetails } from '@/sdk';
import { translator } from '@/lib/i18n';
import { galleryProductFixture, productFixture } from '@/test/product-fixtures';
import { ProductGallery } from './ProductGallery';

function renderGallery(details: ProductDetails, locale: Locale = 'en') {
  const t = translator(locale);
  return render(
    <ProductGallery
      images={details.gallery}
      video={details.video}
      name={details.product.name}
      locale={locale}
      labels={{
        gallery: t('productGallery'),
        imageOf: t('productImageOf'),
        video: t('productVideo'),
        playVideo: t('productPlayVideo'),
        previous: t('productPreviousImage'),
        next: t('productNextImage'),
      }}
    />,
  );
}

describe('ProductGallery', () => {
  it('starts with the main image and lists every image and the video', () => {
    const details = galleryProductFixture('en');
    renderGallery(details);

    expect(screen.getByTestId('product-gallery-image')).toHaveAttribute('src', details.gallery[0].url);
    const thumbs = within(screen.getByRole('list', { name: 'Product images' })).getAllByRole('button');
    expect(thumbs.map((b) => b.getAttribute('aria-label'))).toEqual(['Image 1 of 5', 'Image 2 of 5', 'Image 3 of 5', 'Image 4 of 5', 'Product video']);
    expect(thumbs[0]).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'Previous image' })).toBeDisabled();
  });

  it('shows the picked image, and moves with the arrows', async () => {
    const details = galleryProductFixture('en');
    renderGallery(details);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Image 3 of 5' }));
    expect(screen.getByTestId('product-gallery-image')).toHaveAttribute('src', details.gallery[2].url);
    expect(screen.getByTestId('product-gallery-image')).toHaveAttribute('alt', details.gallery[2].alt);

    await user.click(screen.getByRole('button', { name: 'Next image' }));
    expect(screen.getByTestId('product-gallery-image')).toHaveAttribute('src', details.gallery[3].url);
  });

  it('works from the keyboard: arrow keys, Home and End move between thumbnails', async () => {
    const details = galleryProductFixture('en');
    renderGallery(details);
    const user = userEvent.setup();
    const first = screen.getByRole('button', { name: 'Image 1 of 5' });

    // "Next image", then the thumbnails: only the current one is in the tab order, the arrows move inside.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Next image' })).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(first).not.toHaveFocus();
    await user.tab({ shift: true });
    expect(first).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Image 2 of 5' })).toHaveFocus();
    expect(screen.getByTestId('product-gallery-image')).toHaveAttribute('src', details.gallery[1].url);

    await user.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Product video' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute('aria-current', 'true');
  });

  it('opens the video in a new tab from its slide', async () => {
    const details = galleryProductFixture('en');
    renderGallery(details);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Product video' }));
    const play = within(screen.getByTestId('product-video')).getByRole('link', { name: 'Play video' });
    expect(play).toHaveAttribute('href', details.video!.url);
    expect(play).toHaveAttribute('target', '_blank');
    expect(play).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('never links a video address that is not a web address', async () => {
    const details = galleryProductFixture('en');
    details.video = { url: 'javascript:alert(1)', thumbnail: null };
    renderGallery(details);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Product video' }));
    expect(within(screen.getByTestId('product-video')).queryByRole('link')).toBeNull();
  });

  it('has no thumbnails or arrows for a single image, and a placeholder for none', () => {
    const details = productFixture('en');
    const { unmount } = renderGallery(details);
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();
    unmount();

    details.gallery = [];
    renderGallery(details);
    expect(screen.queryByTestId('product-gallery-image')).toBeNull();
  });

  it('speaks Arabic with Arabic digits', () => {
    renderGallery(galleryProductFixture('ar'), 'ar');
    expect(screen.getByRole('button', { name: 'صورة ٢ من ٥' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'فيديو المنتج' })).toBeInTheDocument();
  });
});
