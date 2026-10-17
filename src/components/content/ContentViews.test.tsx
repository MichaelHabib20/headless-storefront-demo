/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { branchesFixture, contactPageFixture, contentPageFixture, fileFormFixture, merchantFormFixture } from '@/test/shell-fixtures';
import { BranchesList } from './BranchesList';
import { ContactDetails } from './ContactDetails';
import { ContentForm } from './ContentForm';
import { ContentPageView, withoutH1 } from './ContentPageView';
import type { ContentFormState } from './form-values';

describe('CMS page', () => {
  it('shows the title and the cleaned merchant text in English and Arabic', () => {
    const { unmount } = render(<ContentPageView page={contentPageFixture('en')} locale="en" />);
    expect(screen.getByRole('heading', { level: 1, name: 'About Us' })).toBeInTheDocument();
    expect(screen.getByTestId('content-body').querySelector('h2')).toHaveTextContent('Who we are');
    expect(screen.getByRole('link', { name: 'Our story' })).toHaveAttribute('href', 'https://example.com/story');
    unmount();

    render(<ContentPageView page={contentPageFixture('ar')} locale="ar" />);
    expect(screen.getByRole('heading', { level: 1, name: 'عن الشركة' })).toBeInTheDocument();
  });

  it('keeps one h1: headings level 1 in the merchant text become h2 (EN and AR)', () => {
    const content = { html: '<h1 class="x">About Us – Seif Pharmacies</h1><p>Text</p><H1>Second</H1>' };
    const { container, unmount } = render(<ContentPageView page={{ ...contentPageFixture('en'), content }} locale="en" />);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('About Us');
    expect(screen.getByRole('heading', { level: 2, name: 'About Us – Seif Pharmacies' })).toHaveClass('x');
    unmount();

    const ar = render(<ContentPageView page={{ ...contentPageFixture('ar'), content: { html: '<h1>Cookie Policy</h1>' } }} locale="ar" />);
    expect(ar.container.querySelectorAll('h1')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'عن الشركة' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Cookie Policy' })).toBeInTheDocument();
  });

  it('leaves text without an h1 as it is', () => {
    const value = { html: '<h2>Who</h2><p>h1 is a word</p><h10>x</h10>' };
    expect(withoutH1(value)).toBe(value);
    expect(withoutH1(null)).toBeNull();
  });

  it('keeps a hidden title for screen readers only', () => {
    render(<ContentPageView page={{ ...contentPageFixture('en'), showTitle: false }} locale="en" />);
    expect(screen.getByRole('heading', { level: 1, name: 'About Us' })).toHaveClass('visually-hidden');
  });

  it('embeds only web pages', () => {
    const { container, rerender } = render(<ContentPageView page={{ ...contentPageFixture('en'), iframeUrl: 'https://maps.example.com/embed' }} locale="en" />);
    expect(container.querySelector('iframe')).toHaveAttribute('src', 'https://maps.example.com/embed');
    rerender(<ContentPageView page={{ ...contentPageFixture('en'), iframeUrl: 'javascript:alert(1)' }} locale="en" />);
    expect(container.querySelector('iframe')).toBeNull();
  });
});

describe('contact details and branches', () => {
  it('lists the store details from the API', () => {
    render(<ContactDetails contact={contactPageFixture('ar').contact!} locale="ar" whatsappUrl="https://wa.me/201221919919" />);
    expect(screen.getByRole('link', { name: '19199' })).toHaveAttribute('href', 'tel:19199');
    expect(screen.getByRole('link', { name: '201221919919' })).toHaveAttribute('href', 'https://wa.me/201221919919');
    expect(screen.getByText('الخط الساخن')).toBeInTheDocument();
  });

  it('shows the branches by group with the API map links', () => {
    render(<BranchesList branches={branchesFixture('en')} locale="en" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Stores' })).toBeInTheDocument();
    expect(screen.getAllByTestId('branch')).toHaveLength(3);
    const maps = screen.getAllByTestId('branch-map');
    expect(maps.map((link) => link.getAttribute('href'))).toEqual(['https://g.co/kgs/q3V9Wsw', 'https://www.google.com/maps?q=30.3954787,30.3752689']);
    expect(maps[0]).toHaveAttribute('target', '_blank');
  });

  it('says so when there are no branches', () => {
    render(<BranchesList branches={{ groups: [] }} locale="ar" />);
    expect(screen.getByText('لا توجد فروع لعرضها حاليًا.')).toBeInTheDocument();
  });
});

describe('forms drawn from the API', () => {
  it('draws every field kind with the API labels', () => {
    const form = merchantFormFixture('en');
    const { container } = render(<ContentForm locale="en" fields={form.fields} action={vi.fn()} submitLabel={form.submitLabel} idPrefix="f" testId="merchant-form" upload={vi.fn()} />);
    expect(screen.getByLabelText('First name')).toHaveAttribute('name', 'v.firstName');
    expect(screen.getByLabelText('Phone')).toHaveAttribute('type', 'tel');
    expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Branch').tagName).toBe('SELECT');
    expect(screen.getByLabelText(/Topics/)).toHaveAttribute('multiple');
    expect(screen.getByLabelText('Your message').tagName).toBe('TEXTAREA');
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Send feedback' })).toBeInTheDocument();
  });

  it('shows the API messages next to the fields and the thank-you after a send', async () => {
    const answers: ContentFormState[] = [
      { ok: false, message: 'Please check the highlighted fields.', fieldErrors: { field1: 'Choose one of the options.' }, values: { firstName: 'Mona' } },
      { ok: true, message: 'Thank you, we received your answers.' },
    ];
    const action = vi.fn(async () => answers.shift()!);
    const form = merchantFormFixture('en');
    render(<ContentForm locale="en" fields={form.fields} action={action} submitLabel={form.submitLabel} hidden={{ slug: 'feedback' }} idPrefix="f" testId="merchant-form" />);
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Mona' } });
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '01000000001' } });
    fireEvent.change(screen.getByLabelText('Branch'), { target: { value: 'obour' } });
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hello' } });

    fireEvent.submit(screen.getByTestId('merchant-form'));
    await waitFor(() => expect(screen.getByText('Choose one of the options.')).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByLabelText('Branch')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('First name')).toHaveValue('Mona');
    const sent = (action.mock.calls[0] as unknown as [ContentFormState, FormData])[1];
    expect(sent.get('slug')).toBe('feedback');
    expect(sent.get('locale')).toBe('en');

    fireEvent.submit(screen.getByTestId('merchant-form'));
    await waitFor(() => expect(screen.getByTestId('merchant-form-message')).toHaveTextContent('Thank you, we received your answers.'), { timeout: 5000 });
    expect(screen.getByTestId('merchant-form-message')).toHaveAttribute('role', 'status');
    expect(screen.queryByText('Choose one of the options.')).toBeNull();
  });

  it('uploads a chosen file and sends its id', async () => {
    const upload = vi.fn(async () => ({ ok: true as const, id: 'mock-upload-7', name: 'rx.png' }));
    const form = fileFormFixture('ar');
    const { container } = render(<ContentForm locale="ar" fields={form.fields} action={vi.fn()} submitLabel={form.submitLabel} upload={upload} idPrefix="f" testId="merchant-form" />);

    fireEvent.change(screen.getByTestId('file-field1'), { target: { files: [new File(['x'], 'rx.png', { type: 'image/png' })] } });
    await waitFor(() => expect(screen.getByText('تم الرفع: rx.png')).toBeInTheDocument());
    expect(container.querySelector('input[type="hidden"][name="v.field1"]')).toHaveValue('mock-upload-7');
  });

  it('refuses every empty field to fill at once, before sending, and keeps what was typed', async () => {
    const action = vi.fn(async (): Promise<ContentFormState> => ({ ok: true }));
    const form = merchantFormFixture('en');
    render(<ContentForm locale="en" fields={form.fields} action={action} submitLabel={form.submitLabel} idPrefix="f" testId="merchant-form" />);
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '01000000001' } });

    fireEvent.submit(screen.getByTestId('merchant-form'));
    await waitFor(() => expect(screen.getAllByTestId('field-error')).toHaveLength(3));
    expect(action).not.toHaveBeenCalled();
    for (const name of ['First name', 'Branch', 'Your message']) expect(screen.getByLabelText(name)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Phone')).toHaveValue('01000000001');
    expect(screen.getByLabelText('Phone')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByLabelText('First name')).toHaveFocus();
  });

  it.each([
    ['en', 'We could not send this. Check your connection and try again.'],
    ['ar', 'تعذر الإرسال. تحقق من اتصالك وحاول مرة أخرى.'],
  ] as const)('a request that fails (offline, an error page) shows a message and keeps what was typed (%s)', async (locale, message) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const form = contactPageFixture(locale).contact!;
    const action = vi.fn(async (): Promise<ContentFormState> => {
      throw new TypeError('Failed to fetch');
    });
    render(<ContentForm locale={locale} fields={form.fields} action={action} submitLabel="Send" idPrefix="c" testId="contact-form" />);
    for (const field of form.fields) {
      const input = document.getElementById(`c-${field.name}`) as HTMLInputElement | null;
      if (input && input.tagName !== 'SELECT') fireEvent.change(input, { target: { value: field.kind === 'email' ? 'mona@example.com' : field.kind === 'phone' ? '01000000001' : 'Hello' } });
    }
    fireEvent.submit(screen.getByTestId('contact-form'));
    expect(await screen.findByTestId('contact-form-message')).toHaveTextContent(message);
    expect(action).toHaveBeenCalledOnce();
    const typed = document.getElementById(`c-${form.fields[0].name}`) as HTMLInputElement;
    expect(typed.value).not.toBe('');
    log.mockRestore();
  });

  it('marks fields to fill with a required input and the others as optional', () => {
    const form = merchantFormFixture('ar');
    render(<ContentForm locale="ar" fields={form.fields} action={vi.fn()} submitLabel={form.submitLabel} idPrefix="f" testId="merchant-form" upload={vi.fn()} />);
    expect(screen.getByLabelText('الفرع')).toBeRequired();
    expect(screen.getByLabelText(/البريد الإلكتروني/)).not.toBeRequired();
    expect(screen.getAllByText('(اختياري)')).toHaveLength(form.fields.filter((field) => !field.required).length);
  });

  describe('a one-upload form (the prescriptions form)', () => {
    // staging leaves its only field optional; an empty answer must still not be sent
    const optionalUpload = (locale: 'en' | 'ar') => fileFormFixture(locale).fields.map((field) => ({ ...field, required: false }));

    it.each([
      ['en', 'Please attach at least one image.'],
      ['ar', 'يرجى إرفاق صورة واحدة على الأقل.'],
    ] as const)('cannot be sent without a file (%s)', async (locale, message) => {
      const action = vi.fn(async (): Promise<ContentFormState> => ({ ok: true }));
      render(<ContentForm locale={locale} fields={optionalUpload(locale)} action={action} submitLabel="Send" upload={vi.fn()} idPrefix="f" testId="merchant-form" />);
      expect(screen.getByTestId('file-field1')).toBeRequired();
      expect(screen.queryByText(/optional|اختياري/)).toBeNull();

      fireEvent.submit(screen.getByTestId('merchant-form'));
      await waitFor(() => expect(screen.getByTestId('field-error')).toHaveTextContent(message));
      expect(screen.getByTestId('file-field1')).toHaveAttribute('aria-invalid', 'true');
      expect(action).not.toHaveBeenCalled();
    });

    it.each(['en', 'ar'] as const)('the "attach an image" message goes once a file is attached (%s)', async (locale) => {
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview-2'), revokeObjectURL: vi.fn() });
      const upload = vi.fn(async () => ({ ok: true as const, id: 'mock-upload-8', name: 'rx.png' }));
      render(<ContentForm locale={locale} fields={optionalUpload(locale)} action={vi.fn()} submitLabel="Send" upload={upload} idPrefix="f" testId="merchant-form" />);
      fireEvent.submit(screen.getByTestId('merchant-form'));
      await waitFor(() => expect(screen.getByTestId('field-error')).toBeInTheDocument());

      fireEvent.change(screen.getByTestId('file-field1'), { target: { files: [new File(['x'], 'rx.png', { type: 'image/png' })] } });
      await waitFor(() => expect(screen.queryByTestId('field-error')).toBeNull());
      expect(screen.getByTestId('file-field1')).not.toHaveAttribute('aria-invalid');
    });

    it('shows the chosen picture in the tile and sends once a file is uploaded', async () => {
      const createObjectURL = vi.fn(() => 'blob:preview-1');
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const upload = vi.fn(async () => ({ ok: true as const, id: 'mock-upload-9', name: 'rx.png' }));
      const action = vi.fn(async (): Promise<ContentFormState> => ({ ok: true, message: 'Thank you, we received your answers.' }));
      render(<ContentForm locale="en" fields={optionalUpload('en')} action={action} submitLabel="Send" upload={upload} idPrefix="f" testId="merchant-form" />);
      expect(screen.getByTestId('file-tile')).toHaveAttribute('for', 'f-field1');
      expect(screen.queryByTestId('file-preview')).toBeNull();

      fireEvent.change(screen.getByTestId('file-field1'), { target: { files: [new File(['x'], 'rx.png', { type: 'image/png' })] } });
      await waitFor(() => expect(screen.getByText('Uploaded: rx.png')).toBeInTheDocument());
      expect(screen.getByTestId('file-preview').getAttribute('style')).toContain('blob:preview-1');

      fireEvent.submit(screen.getByTestId('merchant-form'));
      await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
      const sent = (action.mock.calls[0] as unknown as [ContentFormState, FormData])[1];
      expect(sent.get('v.field1')).toBe('mock-upload-9');
    });

    it('removes the chosen file', async () => {
      const upload = vi.fn(async () => ({ ok: true as const, id: 'mock-upload-9', name: 'rx.pdf' }));
      const { container } = render(<ContentForm locale="en" fields={optionalUpload('en')} action={vi.fn()} submitLabel="Send" upload={upload} idPrefix="f" testId="merchant-form" />);
      fireEvent.change(screen.getByTestId('file-field1'), { target: { files: [new File(['x'], 'rx.pdf', { type: 'application/pdf' })] } });
      await waitFor(() => expect(screen.getByTestId('file-tile')).toHaveTextContent('rx.pdf'));
      fireEvent.click(screen.getByRole('button', { name: 'Remove rx.pdf' }));
      expect(container.querySelector('input[type="hidden"][name="v.field1"]')).toHaveValue('');
    });
  });

  it('shows an upload refusal', async () => {
    const upload = vi.fn(async () => ({ ok: false as const, message: 'Upload a jpg, png, webp or pdf file.' }));
    render(<ContentForm locale="en" fields={fileFormFixture('en').fields} action={vi.fn()} submitLabel="Send" upload={upload} idPrefix="f" testId="merchant-form" />);
    fireEvent.change(screen.getByTestId('file-field1'), { target: { files: [new File(['x'], 'notes.txt')] } });
    await waitFor(() => expect(screen.getByText('Upload a jpg, png, webp or pdf file.')).toBeInTheDocument());
  });
});
