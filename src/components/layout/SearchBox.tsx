'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { Locale, SearchSuggestions } from '@/sdk';
import { Price } from '@/money';
import { formatNumber } from '@/lib/numbers';
import { resolveTarget, routes } from '@/lib/routing';
import { Icon } from '../ui/Icon';
import styles from './SearchBox.module.css';

export type SuggestionsAnswer = { ok: true; suggestions: SearchSuggestions } | { ok: false };

/** A server action that reads suggestions for a text (tokens and the API stay on the server). */
export interface SuggestAction {
  (locale: Locale, query: string): Promise<SuggestionsAnswer>;
}

export interface SearchBoxLabels {
  search: string;
  placeholder: string;
  suggestions: string;
  /** "Suggestions: {count}", read to screen readers when the list changes */
  count: string;
  none: string;
  /** "View all results for "{q}"" */
  viewAll: string;
}

interface SearchBoxProps {
  locale: Locale;
  labels: SearchBoxLabels;
  suggest: SuggestAction;
  className?: string;
}

/** Suggestions start after this many characters (the contract allows 1), after a short pause in typing. */
const MIN_CHARS = 2;
const DELAY_MS = 250;

/**
 * The header search. Submitting opens the search page (a plain GET form without JavaScript).
 * While typing it shows the backend's product suggestions in an ARIA combobox: arrows move,
 * Enter opens, Escape closes. The last option is "view all" (the backend's `viewAll` target).
 */
export function SearchBox({ locale, labels, suggest, className }: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState('');
  const [result, setResult] = useState<SearchSuggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);
  const inputId = useId();
  const listId = useId();
  const optionId = (index: number) => `${listId}-option-${index}`;

  // Close after navigating; forget a pending request when the header goes away.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const pending = timer;
    return () => clearTimeout(pending.current);
  }, []);

  const links = result ? [...result.products.map((product) => resolveTarget(product.target, locale)?.href ?? null), resolveTarget(result.viewAll, locale)?.href ?? null] : [];

  function onChange(value: string) {
    setText(value);
    setActive(-1);
    clearTimeout(timer.current);
    const query = value.trim();
    const request = ++latest.current;
    if (query.length < MIN_CHARS) {
      setOpen(false);
      setResult(null);
      return;
    }
    timer.current = setTimeout(async () => {
      let answer: SuggestionsAnswer;
      try {
        answer = await suggest(locale, query);
      } catch {
        answer = { ok: false };
      }
      if (request !== latest.current) return; // the shopper typed on: a newer request answers
      setResult(answer.ok ? answer.suggestions : null);
      setOpen(answer.ok);
    }, DELAY_MS);
  }

  function go(index: number) {
    const href = links[index];
    if (!href) return;
    setOpen(false);
    router.push(href);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    latest.current++;
    clearTimeout(timer.current);
    setOpen(false);
    router.push(routes.search(locale, text.trim()));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const count = links.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!count) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current === -1 && step === -1 ? count - 1 : (current + step + count) % count));
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault();
      go(active);
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (text) {
        onChange('');
      }
    }
  }

  const expanded = open && result !== null;
  const status = !expanded || !result ? '' : result.products.length ? labels.count.replace('{count}', formatNumber(result.products.length, locale)) : labels.none;

  return (
    <form action={routes.search(locale)} method="get" role="search" className={`${styles.search} ${className ?? ''}`} onSubmit={onSubmit}>
      <label htmlFor={inputId} className="visually-hidden">
        {labels.search}
      </label>
      <input
        id={inputId}
        name="search"
        type="search"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        placeholder={labels.placeholder}
        value={text}
        maxLength={200}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => result && text.trim().length >= MIN_CHARS && setOpen(true)}
        onBlur={() => setOpen(false)}
        className={styles.input}
      />
      <button type="submit" className={styles.submit} aria-label={labels.search}>
        <Icon name="search" size={20} />
      </button>

      <div className={styles.popup} hidden={!expanded} data-testid="search-suggestions">
        {result && !result.products.length && <p className={styles.none}>{labels.none}</p>}
        <ul id={listId} role="listbox" aria-label={labels.suggestions} className={styles.list}>
          {result?.products.map((product, index) => (
            <li
              key={product.id}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              className={`${styles.option} ${index === active ? styles.active : ''}`}
              // Keep the focus in the input; the click opens the product.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(index)}
              onMouseEnter={() => setActive(index)}
              data-testid="suggestion"
            >
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- merchant images come from any CDN per store
                <img src={product.image.url} alt="" className={styles.image} loading="lazy" decoding="async" />
              ) : (
                <span className={styles.image} aria-hidden="true" />
              )}
              <span className={styles.name}>{product.name}</span>
              <Price price={product.price} locale={locale} className={styles.price} classNames={{ sale: styles.sale, compareAt: styles.compareAt }} showDiscount={false} />
            </li>
          ))}
          {result && (
            <li
              id={optionId(result.products.length)}
              role="option"
              aria-selected={active === result.products.length}
              className={`${styles.option} ${styles.viewAll} ${active === result.products.length ? styles.active : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(result.products.length)}
              onMouseEnter={() => setActive(result.products.length)}
              data-testid="suggestion-view-all"
            >
              {labels.viewAll.replace('{q}', result.query)}
            </li>
          )}
        </ul>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
