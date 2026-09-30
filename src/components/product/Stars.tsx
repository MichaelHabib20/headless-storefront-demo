import type { CSSProperties } from 'react';
import { ratingFill } from './details';
import styles from './Stars.module.css';

interface StarsProps {
  /** A rating from the API (0–5), e.g. `rating.average` or a review's `rating`. */
  value: number;
  /** What a screen reader says, e.g. "Rated 4.1 out of 5". */
  label: string;
  className?: string;
}

/** Five stars filled as far as the rating goes (fills from the reading start, so RTL works). */
export function Stars({ value, label, className }: StarsProps) {
  return (
    <span
      className={[styles.stars, className].filter(Boolean).join(' ')}
      role="img"
      aria-label={label}
      style={{ '--stars-fill': ratingFill(value) } as CSSProperties}
    >
      <span className={styles.empty} aria-hidden="true">
        ★★★★★
      </span>
      <span className={styles.filled} aria-hidden="true">
        ★★★★★
      </span>
    </span>
  );
}
