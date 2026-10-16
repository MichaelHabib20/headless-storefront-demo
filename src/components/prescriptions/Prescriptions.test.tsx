/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { blockedPrescriptionFormFixture, prescriptionFormFixture, prescriptionsFixture } from '@/test/prescription-fixtures';
import { PrescriptionForm } from './PrescriptionForm';
import { PrescriptionsList } from './PrescriptionsList';

const upload = vi.fn(async () => ({ ok: true as const, id: 'mock-upload-1', name: 'rx.jpg' }));

describe('prescription form (drawn from the API)', () => {
  it('shows the store title, text, fields and the address choices, the default chosen (EN + AR)', () => {
    const { container, unmount } = render(<PrescriptionForm locale="en" form={prescriptionFormFixture('en')} sendAction={vi.fn()} uploadAction={upload} />);
    const form = screen.getByTestId('prescription-form');
    expect(within(form).getByRole('heading', { level: 2, name: 'Prescription' })).toBeInTheDocument();
    expect(screen.getByTestId('prescription-description')).toHaveTextContent('Upload a clear photo of your prescription');
    expect([...container.querySelectorAll('[name^="v."]')].map((input) => input.getAttribute('name'))).toEqual(['v.prescriptionNumber', 'v.note']);
    expect(screen.getByTestId('file-files')).toHaveAttribute('multiple');
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(prescriptionFormFixture('en').addresses.length);
    expect(radios[0]).toBeChecked();
    expect(screen.getByRole('link', { name: 'Add an address' })).toHaveAttribute('href', '/en/add-address');
    expect(screen.getByRole('button', { name: 'Send prescription' })).toBeEnabled();
    unmount();

    render(<PrescriptionForm locale="ar" form={prescriptionFormFixture('ar')} sendAction={vi.fn()} uploadAction={upload} />);
    expect(screen.getByRole('heading', { level: 2, name: 'روشتة' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'إرسال الروشتة' })).toBeInTheDocument();
    expect(screen.getByText('التوصيل إلى')).toBeInTheDocument();
  });

  it('shows only the blockers and the pages that clear them while the backend says it cannot be sent', () => {
    render(<PrescriptionForm locale="ar" form={blockedPrescriptionFormFixture('ar')} sendAction={vi.fn()} uploadAction={upload} />);
    const blockers = screen.getByTestId('prescription-blockers');
    expect(blockers).toHaveTextContent('وثّق رقم هاتفك ليتمكن الصيدلي من الاتصال بك.');
    expect(within(blockers).getByRole('link', { name: 'توثيق رقم هاتفي' })).toHaveAttribute('href', '/ar/verify-phone');
    expect(screen.queryByRole('button', { name: 'إرسال الروشتة' })).toBeNull();
  });

  it('lists each uploaded file (several) and sends their ids under the field', async () => {
    let n = 0;
    const uploads = vi.fn(async () => ({ ok: true as const, id: `mock-upload-${++n}`, name: `rx-${n}.jpg` }));
    const { container } = render(<PrescriptionForm locale="en" form={prescriptionFormFixture('en')} sendAction={vi.fn()} uploadAction={uploads} />);
    const input = screen.getByTestId('file-files');
    fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(screen.getByTestId('files-files')).toHaveTextContent('rx-2.jpg'));
    expect([...container.querySelectorAll('input[type="hidden"][name="v.files"]')].map((hidden) => (hidden as HTMLInputElement).value)).toEqual(['mock-upload-1', 'mock-upload-2']);

    fireEvent.click(screen.getByRole('button', { name: 'Remove rx-1.jpg' }));
    expect([...container.querySelectorAll('input[name="v.files"]')].map((hidden) => (hidden as HTMLInputElement).value)).toEqual(['mock-upload-2']);
  });
});

describe('prescriptions list', () => {
  it('shows them as the API sent them; cancel only where actions.canCancel', () => {
    render(<PrescriptionsList locale="en" page={prescriptionsFixture('en')} reasons={[]} cancelAction={vi.fn()} timeZone="Africa/Cairo" />);
    const items = screen.getAllByTestId('prescription');
    expect(items.map((item) => item.getAttribute('data-id'))).toEqual(['1042', '1041']);
    expect(within(items[0]).getByTestId('prescription-status')).toHaveTextContent('Received');
    expect(within(items[0]).getByText('Morning, please')).toBeInTheDocument();
    expect(within(items[0]).getByTestId('prescription-cancel')).toBeInTheDocument();
    expect(within(items[1]).queryByTestId('prescription-cancel')).toBeNull();
    expect(within(items[0]).getByText('Files: 2')).toBeInTheDocument();
  });

  it('Arabic, with Latin digits for counts, and an empty state', () => {
    const { unmount } = render(<PrescriptionsList locale="ar" page={prescriptionsFixture('ar')} reasons={[]} cancelAction={vi.fn()} />);
    expect(screen.getAllByTestId('prescription-status')[1]).toHaveTextContent('جاري التجهيز');
    expect(screen.getByText('الملفات: 2')).toBeInTheDocument();
    unmount();
    render(<PrescriptionsList locale="ar" page={{ items: [], pagination: { page: 1, perPage: 10, total: 0, totalPages: 0 } }} reasons={[]} cancelAction={vi.fn()} />);
    expect(screen.getByTestId('prescriptions-empty')).toHaveTextContent('لم ترسل أي روشتة بعد.');
  });
});
