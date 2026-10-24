/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messagesForTest } from '@/lib/i18n';
import { Rail, RailItem } from './Rail';

const moves = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  moves.mockReset();
  Element.prototype.scrollBy = moves as unknown as Element['scrollBy'];
  Element.prototype.scrollTo = moves as unknown as Element['scrollTo'];
});
afterEach(() => {
  vi.useRealTimers();
});

const LABELS = { pauseLabel: 'Pause slideshow', playLabel: 'Play slideshow' };

const draw = (autoplayMs?: number, perView?: 1 | 4) =>
  render(
    <Rail label="Slides" previousLabel="Previous" nextLabel="Next" perView={perView} autoplay={autoplayMs ? { ms: autoplayMs, ...LABELS } : undefined}>
      <RailItem>
        <a href="#a">a</a>
      </RailItem>
      <RailItem>b</RailItem>
    </Rail>,
  );

const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('Rail autoplay', () => {
  it('does not move on its own without autoplay, and has no pause button', () => {
    draw();
    tick(20_000);
    expect(moves).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rail-autoplay')).toBeNull();
  });

  it('moves every `ms`, and pauses while hovered', () => {
    const { container } = draw(3000, 1);
    tick(3000);
    expect(moves).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(container.firstElementChild!);
    tick(9000);
    expect(moves).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(container.firstElementChild!);
    tick(3000);
    expect(moves).toHaveBeenCalledTimes(2);
  });

  it('pauses while the keyboard focus is on a slide', () => {
    draw(3000, 1);
    act(() => screen.getByRole('link', { name: 'a' }).focus());
    tick(9000);
    expect(moves).not.toHaveBeenCalled();
    act(() => screen.getByRole('link', { name: 'a' }).blur());
    tick(3000);
    expect(moves).toHaveBeenCalledTimes(1);
  });

  it('a visible pause/play button stops and restarts it (mouse and keyboard)', async () => {
    // only the rail's interval is faked: user-event keeps its real (zero) delays
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const user = userEvent.setup();
    draw(3000, 1);
    const pause = screen.getByRole('button', { name: 'Pause slideshow' });
    expect(pause).toBeVisible();
    await user.click(pause);
    fireEvent.mouseLeave(pause.closest('div')!); // the pointer leaves: still stopped by the button
    tick(12_000);
    expect(moves).not.toHaveBeenCalled();

    // keyboard: focus the button (Tab) and press Enter / Space
    const play = screen.getByRole('button', { name: 'Play slideshow' });
    act(() => play.focus());
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Pause slideshow' })).toHaveFocus();
    // focus on the button itself does not pause: playing resumes right away
    tick(3000);
    expect(moves).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(screen.getByRole('button', { name: 'Play slideshow' })).toBeInTheDocument();
    tick(9000);
    expect(moves).toHaveBeenCalledTimes(1);
  });

  it('has English and Arabic labels for the button', () => {
    expect(messagesForTest.en.pauseSlides).toBe('Pause slideshow');
    expect(messagesForTest.en.playSlides).toBe('Play slideshow');
    expect(messagesForTest.ar.pauseSlides).toMatch(/[؀-ۿ]/);
    expect(messagesForTest.ar.playSlides).toMatch(/[؀-ۿ]/);
  });

  it('stays still, with no pause button, when the visitor prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    try {
      draw(2000, 1);
      tick(10_000);
      expect(moves).not.toHaveBeenCalled();
      expect(screen.queryByTestId('rail-autoplay')).toBeNull();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
    }
  });

  it('does not move while the tab is hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    try {
      draw(2000, 1);
      tick(10_000);
      expect(moves).not.toHaveBeenCalled();
    } finally {
      hidden.mockRestore();
    }
  });

  it('one slide per view gets the full-width class; other rails are unchanged', () => {
    const { container, unmount } = draw(undefined, 1);
    expect(container.firstElementChild!.className).toMatch(/single/);
    unmount();
    draw(undefined, 4);
    expect(screen.getByRole('list', { name: 'Slides' }).parentElement!.className).not.toMatch(/single/);
  });
});
