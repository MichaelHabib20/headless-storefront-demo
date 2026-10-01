'use client';

import { useId, useState } from 'react';
import type { Locale } from '@/sdk';
import { translator } from '@/lib/i18n';
import { formatNumber } from '@/lib/numbers';
import { fillTemplate } from '../product/details';
import styles from './Rating.module.css';

interface StarInputProps {
  locale: Locale;
  /** The group's label (shown as the legend). */
  label: string;
  /** The form field name; the chosen value (1–5) is submitted under it. */
  name: string;
  required?: boolean;
  value?: number | null;
  onChange?: (value: number) => void;
}

const SCALE = [1, 2, 3, 4, 5] as const;

/** Five radio buttons drawn as stars; works without JavaScript (the value goes with the form). */
export function StarInput({ locale, label, name, required, value = null, onChange }: StarInputProps) {
  const t = translator(locale);
  const id = useId();
  const [chosen, setChosen] = useState<number | null>(value);
  const [hovered, setHovered] = useState<number | null>(null);
  const lit = hovered ?? chosen ?? 0;

  return (
    <fieldset className={styles.stars} data-testid={`stars-${name}`} onMouseLeave={() => setHovered(null)}>
      <legend>{label}</legend>
      {SCALE.map((star) => {
        const text = fillTemplate(star === 1 ? t('ratingStar') : t('ratingStars'), { n: formatNumber(star, locale) });
        return (
          <label key={star} className={styles.star} data-on={star <= lit} onMouseEnter={() => setHovered(star)}>
            <input
              type="radio"
              name={name}
              value={star}
              required={required && star === 1}
              checked={chosen === star}
              aria-label={text}
              aria-describedby={`${id}-legend`}
              onChange={() => {
                setChosen(star);
                onChange?.(star);
              }}
            />
            <span aria-hidden="true">★</span>
          </label>
        );
      })}
    </fieldset>
  );
}
