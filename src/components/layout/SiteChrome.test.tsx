/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { layoutFixture } from '@/test/fixtures';
import { AnnouncementBar } from './AnnouncementBar';
import { WhatsAppButton } from './FloatingActions';
import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

describe('site chrome', () => {
  it('shows the softbar text, and nothing when it is off', () => {
    const layout = layoutFixture('en');
    const { rerender } = render(<AnnouncementBar announcement={layout.announcement} />);
    expect(screen.getByTestId('announcement')).toHaveTextContent(layout.announcement!.text);

    rerender(<AnnouncementBar announcement={null} />);
    expect(screen.queryByTestId('announcement')).toBeNull();
  });

  it('renders every top-level menu item with its link', () => {
    const layout = layoutFixture('en');
    // The real staging menu has ~300 items; query directly (getByRole is slow on large trees).
    const { container } = render(<SiteHeader layout={layout} locale="en" />);
    const nav = container.querySelector<HTMLElement>('nav[aria-label="Main"]')!;

    for (const item of layout.navigation) {
      expect(within(nav).getAllByText(item.label).length).toBeGreaterThan(0);
    }
    expect(within(nav).getByText('Skin Care').closest('a')).toHaveAttribute('href', '/en/c/skin-care');
    expect(within(nav).getByText('Home').closest('a')).toHaveAttribute('href', '/en');
  });

  it('renders footer links, social profiles and hotline from the API', () => {
    const layout = layoutFixture('en');
    render(<SiteFooter layout={layout} locale="en" />);

    for (const link of layout.footer.links) {
      expect(screen.getByText(link.label).closest('a')).toHaveAttribute('href', expect.stringMatching(/^\/en\/(pages|forms)\//));
    }
    for (const profile of layout.footer.social) {
      expect(screen.getByLabelText(profile.platform)).toHaveAttribute('href', profile.url);
    }
    if (layout.footer.contact.hotline) {
      expect(screen.getAllByText(layout.footer.contact.hotline).length).toBeGreaterThan(0);
    }
  });

  it('renders the Arabic chrome', () => {
    render(<SiteHeader layout={layoutFixture('ar')} locale="ar" />);
    expect(screen.getByLabelText('السلة')).toHaveAttribute('href', '/ar/cart');
  });

  it('shows WhatsApp only when enabled', () => {
    const { rerender } = render(<WhatsAppButton whatsapp={{ number: '201', url: 'https://wa.me/201' }} label="Chat" />);
    expect(screen.getByTestId('whatsapp')).toHaveAttribute('href', 'https://wa.me/201');
    rerender(<WhatsAppButton whatsapp={null} label="Chat" />);
    expect(screen.queryByTestId('whatsapp')).toBeNull();
  });
});
