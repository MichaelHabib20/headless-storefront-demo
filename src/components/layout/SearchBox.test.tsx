/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/sdk';
import { messagesForTest } from '@/lib/i18n';
import { suggestionsFixture } from '@/test/fixtures';
import { SearchBox, type SearchBoxLabels, type SuggestAction } from './SearchBox';

const push = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => '/en', useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }) }));

function labels(locale: Locale): SearchBoxLabels {
  const m = messagesForTest[locale];
  return { search: m.search, placeholder: m.searchPlaceholder, suggestions: m.catalogSuggestions, count: m.catalogSuggestionsCount, none: m.catalogNoSuggestions, viewAll: m.catalogViewAllFor };
}

function setup(locale: Locale = 'en', suggest: SuggestAction = vi.fn(async () => ({ ok: true as const, suggestions: suggestionsFixture(locale) }))) {
  render(<SearchBox locale={locale} labels={labels(locale)} suggest={suggest} />);
  const input = screen.getByRole('combobox');
  const type = async (text: string) => {
    fireEvent.change(input, { target: { value: text } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
  };
  return { input, type, suggest };
}

describe('SearchBox', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    push.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('asks for suggestions after a pause, only from 2 characters, and shows them as a listbox', async () => {
    const { input, type, suggest } = setup();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await type('j');
    expect(suggest).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'jo' } });
    fireEvent.change(input, { target: { value: 'joh' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(suggest).toHaveBeenCalledTimes(1);
    expect(suggest).toHaveBeenCalledWith('en', 'joh');

    const data = suggestionsFixture('en');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const options = within(screen.getByRole('listbox', { name: 'Suggestions' })).getAllByRole('option');
    expect(options).toHaveLength(data.products.length + 1);
    expect(options[0]).toHaveTextContent(data.products[0].name);
    expect(options[0]).toHaveTextContent(data.products[0].price!.display);
    expect(options.at(-1)).toHaveTextContent(`View all results for "${data.query}"`);
    expect(screen.getByText(`Suggestions: ${data.products.length}`)).toBeInTheDocument();
  });

  it('moves with the arrows and opens the active suggestion with Enter', async () => {
    const { input, type } = setup();
    await type('johnson');
    const data = suggestionsFixture('en');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', options[1].id);

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith(`/en/${encodeURIComponent(data.products[1].target.slug)}`);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ArrowUp from the box goes to "view all" (the backend viewAll target); Escape closes', async () => {
    const { input, type } = setup();
    await type('johnson');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(screen.getAllByRole('option').at(-1)).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/en/products?search=johnson');
  });

  it('submitting opens the search page for the text', async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '  baby bath ' } });
    fireEvent.submit(input.closest('form')!);
    expect(push).toHaveBeenCalledWith('/en/products?search=baby%20bath');
  });

  it('works as a plain GET form without JavaScript', () => {
    const { input } = setup('ar');
    const form = input.closest('form')!;
    expect(form).toHaveAttribute('action', '/ar/products');
    expect(form).toHaveAttribute('method', 'get');
    expect(input).toHaveAttribute('name', 'search');
    expect(screen.getByRole('search')).toBe(form);
  });

  it('says so when nothing matches (Arabic)', async () => {
    const empty = { ...suggestionsFixture('ar'), products: [] };
    const { type } = setup('ar', vi.fn(async () => ({ ok: true as const, suggestions: empty })));
    await type('zzzz');
    expect(screen.getAllByText('لا توجد منتجات مطابقة').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('stays closed when the suggestions cannot be read', async () => {
    const { input, type } = setup('en', vi.fn(async () => ({ ok: false as const })));
    await type('johnson');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('ignores an older answer that arrives after a newer request', async () => {
    let resolveFirst: (value: Awaited<ReturnType<SuggestAction>>) => void = () => {};
    const suggest = vi
      .fn<SuggestAction>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementationOnce(async () => ({ ok: true, suggestions: { ...suggestionsFixture('en'), query: 'newer' } }));
    const { type } = setup('en', suggest);
    await type('old');
    await type('newer');
    await act(async () => resolveFirst({ ok: true, suggestions: { ...suggestionsFixture('en'), query: 'old' } }));
    expect(screen.getAllByRole('option').at(-1)).toHaveTextContent('"newer"');
  });
});
