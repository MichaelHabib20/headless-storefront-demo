/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PromoBanner } from '@/sdk';
import { homeFixture } from '@/test/fixtures';
import { PromoStrip, promoName } from './PromoStrip';

const banner = (patch: Partial<PromoBanner> = {}, alt: string | null = null): PromoBanner => ({
  id: 1,
  placement: 'top-ad',
  image: { mobile: 'https://cdn.test/m.jpg', desktop: 'https://cdn.test/d.jpg', alt },
  title: null,
  target: { type: 'form', slug: 'prescriptions' },
  ...patch,
});

describe('PromoStrip', () => {
  it('names the image link: the merchant alt, else the ad name, else the slot', () => {
    expect(promoName(banner({ title: 'Top AD' }, 'Send your prescription'))).toBe('Send your prescription');
    expect(promoName(banner({ title: 'Top AD' }))).toBe('Top AD');
    expect(promoName(banner({ title: '  ' }, ' '))).toBe('Top ad');
    expect(promoName(banner({ placement: 'ad-7' }))).toBe('Ad 7');
  });

  it('the recorded home banners are links with a name, in both languages', () => {
    for (const [locale, name] of [
      ['en', 'Top AD'],
      ['ar', 'الاعلان العلوي'],
    ] as const) {
      const { unmount } = render(<PromoStrip banner={homeFixture(locale).promoBanners[0]} locale={locale} />);
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', `/${locale}/forms/prescriptions`);
      unmount();
    }
  });
});
