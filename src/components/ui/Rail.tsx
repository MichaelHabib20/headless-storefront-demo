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
  /** Visible items per row on desktop */
  perView?: 2 | 3 | 4 | 5 | 6;
}

/** Horizontally scrolling row with scroll-snap and arrow buttons (RTL aware). */
export function Rail({ children, label, previousLabel, nextLabel, perView = 4 }: RailProps) {
  const track = useRef<HTMLUListElement>(null);
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

  const scroll = (forward: boolean) => {
    const el = track.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    const amount = el.clientWidth * 0.9 * (forward ? 1 : -1) * (rtl ? -1 : 1);
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className={styles.rail} style={{ ['--per-view' as string]: perView }}>
      <ul ref={track} className={styles.track} aria-label={label}>
        {children}
      </ul>
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
