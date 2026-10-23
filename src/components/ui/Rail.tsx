'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Rail.module.css';

interface RailProps {
  children: ReactNode;
  /** Accessible name of the scrolling list */
  label: string;
  previousLabel: string;
  nextLabel: string;
  /** Visible items per row on desktop (1: one full-width slide, on phones too) */
  perView?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Move forward on its own every `ms` (back to the first item after the last), with a visible pause/play
   * button (WCAG 2.2.2) named by `pauseLabel` / `playLabel`. Also pauses while the pointer or the keyboard
   * focus is in the rail (except on that button) or the tab is hidden; off when the visitor prefers reduced motion.
   */
  autoplay?: { ms: number; pauseLabel: string; playLabel: string };
}

/** Horizontally scrolling row with scroll-snap and arrow buttons (RTL aware). */
export function Rail({ children, label, previousLabel, nextLabel, perView = 4, autoplay }: RailProps) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const autoplayMs = autoplay?.ms;
  // Autoplay runs only after mount and without reduced motion; `stopped` = the visitor pressed pause.
  const [moving, setMoving] = useState(false);
  const [stopped, setStopped] = useState(false);
  const stoppedRef = useRef(false);
  stoppedRef.current = stopped;
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const scrolled = Math.abs(el.scrollLeft);
    setEdges({ start: scrolled < 4, end: scrolled + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const scroll = useCallback((forward: boolean) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const amount = el.clientWidth * 0.9 * (forward ? 1 : -1) * (rtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const box = root.current;
    const el = track.current;
    if (!autoplayMs || !box || !el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    setMoving(true);
    let paused = false;
    const pause = (event?: Event) => {
      // focus on the pause/play button itself does not pause: pressing "play" must play
      if (event?.type === 'focusin' && event.target === toggle.current) return;
      paused = true;
    };
    const resume = () => (paused = false);
    const events: [string, (event?: Event) => void][] = [['mouseenter', pause], ['mouseleave', resume], ['focusin', pause], ['focusout', resume]];
    for (const [name, fn] of events) box.addEventListener(name, fn);
    const timer = window.setInterval(() => {
      if (paused || stoppedRef.current || document.hidden) return;
      const atEnd = Math.abs(el.scrollLeft) + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) el.scrollTo({ left: 0, behavior: 'smooth' });
      else scroll(true);
    }, autoplayMs);
    return () => {
      window.clearInterval(timer);
      for (const [name, fn] of events) box.removeEventListener(name, fn);
      setMoving(false);
    };
  }, [autoplayMs, scroll]);

  return (
    <div ref={root} className={perView === 1 ? `${styles.rail} ${styles.single}` : styles.rail} style={{ ['--per-view' as string]: perView }}>
      <ul ref={track} className={styles.track} aria-label={label}>
        {children}
      </ul>
      {autoplay && moving && (
        <button
          ref={toggle}
          type="button"
          className={`${styles.button} ${styles.toggle}`}
          onClick={() => setStopped((s) => !s)}
          aria-label={stopped ? autoplay.playLabel : autoplay.pauseLabel}
          data-testid="rail-autoplay"
        >
          <Icon name={stopped ? 'play' : 'pause'} size={20} />
        </button>
      )}
      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={() => scroll(false)} disabled={edges.start} aria-label={previousLabel}>
          <Icon name="arrow" directional className={styles.back} />
        </button>
        <button type="button" className={styles.button} onClick={() => scroll(true)} disabled={edges.end} aria-label={nextLabel}>
          <Icon name="arrow" directional />
        </button>
      </div>
    </div>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className={styles.item}>{children}</li>;
}
