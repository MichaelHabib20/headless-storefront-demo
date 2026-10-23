/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

const draw = (autoplayMs?: number, perView?: 1 | 4) =>
  render(
    <Rail label="Slides" previousLabel="Previous" nextLabel="Next" perView={perView} autoplayMs={autoplayMs}>
      <RailItem>a</RailItem>
      <RailItem>b</RailItem>
    </Rail>,
  );

describe('Rail autoplay', () => {
  it('does not move on its own without autoplay', () => {
    draw();
    act(() => void vi.advanceTimersByTime(20_000));
    expect(moves).not.toHaveBeenCalled();
  });

  it('moves every autoplayMs, and pauses while hovered', () => {
    const { container } = draw(3000, 1);
    act(() => void vi.advanceTimersByTime(3000));
    expect(moves).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(container.firstElementChild!);
    act(() => void vi.advanceTimersByTime(9000));
    expect(moves).toHaveBeenCalledTimes(1);
    fireEvent.mouseLeave(container.firstElementChild!);
    act(() => void vi.advanceTimersByTime(3000));
    expect(moves).toHaveBeenCalledTimes(2);
  });

  it('stays still when the visitor prefers reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    try {
      draw(2000, 1);
      act(() => void vi.advanceTimersByTime(10_000));
      expect(moves).not.toHaveBeenCalled();
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
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
