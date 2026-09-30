import type { ReactNode } from 'react';
import type { Locale, ProductOption, ProductOptionValue } from '@/sdk';
import { TargetLink } from '../ui/TargetLink';
import { optionLook, type OptionLook } from './details';
import styles from './ProductOptions.module.css';

export interface ProductOptionsLabels {
  /** Read after a value by screen readers, e.g. "Morning Dew, out of stock". */
  selected: string;
  outOfStock: string;
  unavailable: string;
}

interface ProductOptionsProps {
  options: ProductOption[];
  locale: Locale;
  labels: ProductOptionsLabels;
}

/**
 * The shopper's choices (size, color…). Every value is a link to the product the backend chose
 * for it (`target`); its `state` only changes how it looks. This component never works out which
 * variant matches a combination, and it never enables a value the backend did not give a target.
 */
export function ProductOptions({ options, locale, labels }: ProductOptionsProps) {
  if (!options.length) return null;
  return (
    <div className={styles.options} data-testid="product-options">
      {options.map((option) => (
        <OptionPicker key={option.id} option={option} locale={locale} labels={labels} />
      ))}
    </div>
  );
}

function OptionPicker({ option, locale, labels }: { option: ProductOption; locale: Locale; labels: ProductOptionsLabels }) {
  const look = optionLook(option);
  const selected = option.values.find((value) => value.state === 'selected');
  const heading = (
    <>
      <span className={styles.name}>{option.name}</span>
      {selected && <span className={styles.current}>{selected.label}</span>}
    </>
  );

  if (look === 'dropdown') {
    return (
      <details className={styles.dropdown} data-testid="product-option" data-look={look}>
        <summary className={styles.summary}>{heading}</summary>
        <ul className={styles.menu} aria-label={option.name}>
          {option.values.map((value) => (
            <li key={value.id}>
              <OptionValue value={value} look={look} locale={locale} labels={labels} />
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <div className={styles.option} role="group" aria-label={option.name} data-testid="product-option" data-look={look}>
      <p className={styles.heading}>{heading}</p>
      <ul className={`${styles.values} ${styles[look]}`}>
        {option.values.map((value) => (
          <li key={value.id}>
            <OptionValue value={value} look={look} locale={locale} labels={labels} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What a value shows: its label, a color swatch or its picture (with the label for screen readers). */
function valueFace(value: ProductOptionValue, look: OptionLook): ReactNode {
  if (look === 'color' && value.color) {
    return (
      <>
        <span className={styles.swatch} style={{ background: value.color }} aria-hidden="true" />
        <span className="visually-hidden">{value.label}</span>
      </>
    );
  }
  if (look === 'image' && value.image) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store */}
        <img src={value.image} alt="" className={styles.picture} loading="lazy" decoding="async" />
        <span className={styles.pictureLabel}>{value.label}</span>
      </>
    );
  }
  return <span>{value.label}</span>;
}

function OptionValue({ value, look, locale, labels }: { value: ProductOptionValue; look: OptionLook; locale: Locale; labels: ProductOptionsLabels }) {
  const face = valueFace(value, look);
  const classes = [styles.value, styles[value.state] ?? ''].filter(Boolean).join(' ');

  if (value.state === 'selected') {
    return (
      <span className={classes} aria-current="true" data-state={value.state}>
        {face}
        <span className="visually-hidden">, {labels.selected}</span>
      </span>
    );
  }

  // Clickable only when the backend gave it somewhere to go (never for `unavailable`).
  if (value.state !== 'unavailable' && value.target) {
    return (
      <TargetLink
        target={value.target}
        locale={locale}
        className={classes}
        aria-label={value.state === 'out_of_stock' ? `${value.label}, ${labels.outOfStock}` : value.label}
      >
        {face}
      </TargetLink>
    );
  }

  return (
    <span className={classes} aria-disabled="true" data-state={value.state}>
      {face}
      <span className="visually-hidden">, {labels.unavailable}</span>
    </span>
  );
}
