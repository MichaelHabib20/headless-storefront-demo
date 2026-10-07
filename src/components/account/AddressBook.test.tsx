/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '@/sdk';
import { addressesFixture } from '@/test/account-fixtures';
import { AddressBook } from './AddressBook';
import type { AddressBookAction } from './types';

function setup(locale: Locale = 'en', { savedId = null, next = null }: { savedId?: number | null; next?: 'checkout' | null } = {}) {
  const book = addressesFixture(locale);
  const onDelete = vi.fn<AddressBookAction>();
  const onMakeDefault = vi.fn<AddressBookAction>();
  render(<AddressBook items={book.items} locale={locale} next={next} savedId={savedId} onDelete={onDelete} onMakeDefault={onMakeDefault} />);
  return { book, onDelete, onMakeDefault };
}

const card = (id: number) => screen.getAllByTestId('address').find((node) => node.getAttribute('data-address-id') === String(id))!;

const stopNavigation = (event: Event) => {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
};
beforeEach(() => document.addEventListener('click', stopNavigation));
afterEach(() => document.removeEventListener('click', stopNavigation));

describe('AddressBook', () => {
  it.each([
    ['en', 'Default address', 'We do not deliver to this address at the moment.'],
    ['ar', 'العنوان الافتراضي', 'لا نوصّل إلى هذا العنوان حالياً.'],
  ] as const)('shows the API text of each address, the default first (%s)', (locale, defaultLabel, notDeliverable) => {
    const { book } = setup(locale);
    const cards = screen.getAllByTestId('address');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveAttribute('data-default', 'true');
    expect(within(cards[0]).getByText(defaultLabel)).toBeInTheDocument();
    book.items.forEach((address) => expect(within(card(address.id)).getByTestId('address-text')).toHaveTextContent(address.formatted));
    const remote = book.items.find((address) => !address.deliverable)!;
    expect(within(card(remote.id)).getByTestId('address-not-deliverable')).toHaveTextContent(notDeliverable);
    expect(within(cards[0]).queryByTestId('address-not-deliverable')).toBeNull();
  });

  it('shows the default first even when the API lists it later', () => {
    const book = addressesFixture('en');
    const items = [...book.items].reverse();
    render(<AddressBook items={items} locale="en" next={null} savedId={null} onDelete={vi.fn()} onMakeDefault={vi.fn()} />);
    expect(screen.getAllByTestId('address')[0]).toHaveAttribute('data-default', 'true');
  });

  it('links to the edit page and keeps the return page', () => {
    setup('en', { next: 'checkout' });
    expect(within(card(501)).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/en/account/address/edit/501?next=checkout');
    // the default address has no "make default"
    expect(within(card(501)).queryByRole('button', { name: 'Make default' })).toBeNull();
  });

  it('makes an address the default and shows the address book the API answered', async () => {
    const { book, onMakeDefault } = setup();
    const other = book.items[1];
    onMakeDefault.mockResolvedValue({ ok: true, items: [{ ...other, isDefault: true }, { ...book.items[0], isDefault: false }] });

    fireEvent.click(within(card(other.id)).getByRole('button', { name: 'Make default' }));

    await waitFor(() => expect(screen.getByTestId('addresses-status')).toHaveTextContent('Your default address was changed.'));
    expect(onMakeDefault).toHaveBeenCalledWith('en', other.id);
    expect(screen.getAllByTestId('address')[0]).toHaveAttribute('data-address-id', String(other.id));
  });

  it('asks before deleting, and can keep the address', async () => {
    const { book, onDelete } = setup();
    fireEvent.click(within(card(501)).getByRole('button', { name: 'Delete' }));
    expect(within(card(501)).getByText('Delete this address?')).toBeInTheDocument();
    expect(within(card(501)).getByRole('button', { name: 'Keep it' })).toHaveFocus();
    fireEvent.click(within(card(501)).getByRole('button', { name: 'Keep it' }));
    expect(onDelete).not.toHaveBeenCalled();

    onDelete.mockResolvedValue({ ok: true, items: [{ ...book.items[1], isDefault: true }] });
    fireEvent.click(within(card(501)).getByRole('button', { name: 'Delete' }));
    fireEvent.click(within(card(501)).getByRole('button', { name: 'Yes, delete' }));

    await waitFor(() => expect(screen.getAllByTestId('address')).toHaveLength(1));
    expect(onDelete).toHaveBeenCalledWith('en', 501);
    expect(screen.getByTestId('addresses-status')).toHaveTextContent('The address was deleted.');
    expect(screen.getByTestId('addresses-status')).toHaveFocus();
    expect(screen.getAllByTestId('address')[0]).toHaveAttribute('data-default', 'true');
  });

  it("shows the API's message when a change is refused", async () => {
    const { onDelete } = setup('ar');
    onDelete.mockResolvedValue({ ok: false, message: 'غير موجود.' });
    fireEvent.click(within(card(501)).getByRole('button', { name: 'حذف' }));
    fireEvent.click(within(card(501)).getByRole('button', { name: 'نعم، احذف' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('غير موجود.');
    expect(screen.getAllByTestId('address')).toHaveLength(2);
  });

  it('announces the address just saved (the id the API answered with)', () => {
    setup('en', { savedId: 501 });
    expect(screen.getByTestId('addresses-status')).toHaveTextContent('The address was saved.');
    expect(card(501).className).toContain('saved');
  });

  it('shows the empty state when the last address is gone', async () => {
    const onDelete = vi.fn<AddressBookAction>(async () => ({ ok: true, items: [] }));
    render(<AddressBook items={[addressesFixture('en').items[0]]} locale="en" next={null} savedId={null} onDelete={onDelete} onMakeDefault={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect(await screen.findByTestId('addresses-empty')).toHaveTextContent('No saved addresses yet');
  });
});
