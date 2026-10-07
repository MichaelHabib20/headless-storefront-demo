/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareButton } from './ShareButton';

afterEach(() => {
  // @ts-expect-error -- test only: the Web Share API is added and removed per test
  delete navigator.share;
});

describe('ShareButton', () => {
  it('opens a menu with the network links for the page URL when the browser cannot share', () => {
    render(<ShareButton locale="en" title="Baby Cologne" url="https://shop.example/en/baby-cologne" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const menu = screen.getByRole('menu', { name: 'Share this product' });
    expect(within(menu).getByRole('menuitem', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/?text=Baby%20Cologne%20https%3A%2F%2Fshop.example%2Fen%2Fbaby-cologne');
    expect(within(menu).getByRole('menuitem', { name: 'Facebook' })).toHaveAttribute('href', 'https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fshop.example%2Fen%2Fbaby-cologne');
    expect(within(menu).getByRole('menuitem', { name: 'X' })).toHaveAttribute('href', expect.stringContaining('twitter.com/intent/tweet?text=Baby%20Cologne'));
  });

  it('uses the Web Share API when the browser has it', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
    render(<ShareButton locale="ar" title="كولونيا" url="https://shop.example/ar/x" />);
    fireEvent.click(await screen.findByRole('button', { name: 'مشاركة' }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: 'كولونيا', url: 'https://shop.example/ar/x' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareButton locale="en" title="T" url="https://shop.example/en/t" />);
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy link' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://shop.example/en/t'));
    expect(await screen.findByRole('menuitem', { name: 'Link copied' })).toBeInTheDocument();
  });
});
