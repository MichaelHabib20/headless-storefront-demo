import { revalidatePath } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, getCart, setArea, uploadFile, getForm, getPage, sendContactMessage, submitForm } from '@/sdk';
import { sendContactAction } from '@/app/[locale]/pages/[slug]/actions';
import { submitFormAction, uploadFormFileAction } from '@/app/[locale]/forms/[slug]/actions';
import { ensureShopperContext, shopperContext } from '@/lib/shopper.server';
import { cartFixture } from '@/test/fixtures';
import { contactPageFixture, merchantFormFixture } from '@/test/shell-fixtures';
import { chooseAreaAction, readMiniCart } from './shell.actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sdk')>()),
  getCart: vi.fn(),
  setArea: vi.fn(),
  getPage: vi.fn(),
  sendContactMessage: vi.fn(),
  getForm: vi.fn(),
  submitForm: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock('@/lib/storefront.server', () => ({ storefrontClient: vi.fn(() => ({})) }));
vi.mock('@/lib/shopper.server', () => ({ shopperContext: vi.fn(), ensureShopperContext: vi.fn(), guestToken: vi.fn(async () => null), forgetGuest: vi.fn() }));

const validation = (fields: Record<string, string[]>) => new ApiError('validation', 422, 'Please check the highlighted fields.', fields);

function form(values: Record<string, string | string[]>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) for (const item of [value].flat()) data.append(key, item);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'guest-1' }));
});

describe('mini cart read', () => {
  it('never creates a session: no token → no cart', async () => {
    vi.mocked(shopperContext).mockResolvedValue({ locale: 'en', token: null });
    await expect(readMiniCart('en')).resolves.toEqual({ status: 'none' });
    expect(getCart).not.toHaveBeenCalled();
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('answers the API cart as it is; an expired session is no cart; failures are errors', async () => {
    vi.mocked(shopperContext).mockResolvedValue({ locale: 'ar', token: 't' });
    vi.mocked(getCart).mockResolvedValueOnce(cartFixture('ar'));
    await expect(readMiniCart('ar')).resolves.toEqual({ status: 'ok', cart: cartFixture('ar') });
    vi.mocked(getCart).mockRejectedValueOnce(new ApiError('unauthenticated', 401, 'x'));
    await expect(readMiniCart('ar')).resolves.toEqual({ status: 'none' });
    vi.mocked(getCart).mockRejectedValueOnce(new ApiError('server', 500, 'x'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => undefined);
    await expect(readMiniCart('ar')).resolves.toEqual({ status: 'error' });
  });
});

describe('area', () => {
  it('saves the area with the shopper session and re-reads the layout', async () => {
    vi.mocked(setArea).mockResolvedValue({} as never);
    await expect(chooseAreaAction('en', 12)).resolves.toEqual({ ok: true });
    expect(setArea).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'guest-1' }, 12);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]', 'layout');
  });

  it('shows the API refusal; refuses bad ids without calling it', async () => {
    vi.mocked(setArea).mockRejectedValue(validation({ areaId: ['This area is not available. Please choose another one.'] }));
    await expect(chooseAreaAction('en', 22)).resolves.toEqual({ ok: false, message: 'This area is not available. Please choose another one.' });
    await expect(chooseAreaAction('ar', -1)).resolves.toEqual({ ok: false, message: 'تعذر حفظ منطقتك. حاول مرة أخرى.' });
    expect(setArea).toHaveBeenCalledTimes(1);
  });
});

describe('contact form', () => {
  it('sends only the fields of the contact page, without a session', async () => {
    vi.mocked(getPage).mockResolvedValue(contactPageFixture('en'));
    vi.mocked(sendContactMessage).mockResolvedValue({ message: 'Thank you, we received your message and will get back to you soon.' });

    const state = await sendContactAction({}, form({ locale: 'en', 'v.name': ' Mona ', 'v.phone': '0100', 'v.message': 'Hi', 'v.attachment': 'https://evil', resolved: '1' }));

    expect(state).toEqual({ ok: true, message: 'Thank you, we received your message and will get back to you soon.' });
    expect(sendContactMessage).toHaveBeenCalledWith(expect.anything(), 'en', { name: 'Mona', phone: '0100', message: 'Hi' });
    expect(ensureShopperContext).not.toHaveBeenCalled();
  });

  it('passes the API field messages back with what was typed', async () => {
    vi.mocked(getPage).mockResolvedValue(contactPageFixture('ar'));
    vi.mocked(sendContactMessage).mockRejectedValue(validation({ phone: ['هذا الحقل مطلوب.'] }));
    const state = await sendContactAction({}, form({ locale: 'ar', 'v.name': 'منى' }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { phone: 'هذا الحقل مطلوب.' }, values: { name: 'منى' } });
  });
});

describe('merchant form', () => {
  it('answers the described fields with the shopper session', async () => {
    vi.mocked(getForm).mockResolvedValue(merchantFormFixture('en'));
    vi.mocked(submitForm).mockResolvedValue({ message: 'Thank you, we received your answers.' });

    const state = await submitFormAction({}, form({ locale: 'en', slug: 'feedback', 'v.firstName': 'Mona', 'v.field2': ['prices', 'service'], 'v.field4': 'mock-upload-1', 'v.notes': 'x' }));

    expect(state).toEqual({ ok: true, message: 'Thank you, we received your answers.' });
    expect(submitForm).toHaveBeenCalledWith(expect.anything(), { locale: 'en', token: 'guest-1' }, 'feedback', { firstName: 'Mona', field2: ['prices', 'service'], field4: 'mock-upload-1' });
  });

  it('keeps what was typed but never the file id when the API refuses', async () => {
    vi.mocked(getForm).mockResolvedValue(merchantFormFixture('en'));
    vi.mocked(submitForm).mockRejectedValue(validation({ field1: ['Choose one of the options.'] }));
    const state = await submitFormAction({}, form({ locale: 'en', slug: 'feedback', 'v.firstName': 'Mona', 'v.field4': 'mock-upload-1' }));
    expect(state).toMatchObject({ ok: false, fieldErrors: { field1: 'Choose one of the options.' }, values: { firstName: 'Mona' } });
    expect(state.values).not.toHaveProperty('field4');
  });

  it('a session the API no longer knows asks to sign in again', async () => {
    vi.mocked(getForm).mockResolvedValue(merchantFormFixture('ar'));
    vi.mocked(ensureShopperContext).mockImplementation(async (locale) => ({ locale, token: 'customer-token' }));
    vi.mocked(submitForm).mockRejectedValue(new ApiError('unauthenticated', 401, 'x'));
    await expect(submitFormAction({}, form({ locale: 'ar', slug: 'feedback' }))).resolves.toMatchObject({ ok: false, message: 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.' });
  });

  it('uploads a file of a form field', async () => {
    vi.mocked(uploadFile).mockResolvedValue({ id: 'mock-upload-3', name: 'rx.png' });
    const data = new FormData();
    data.set('file', new File(['x'], 'rx.png', { type: 'image/png' }));
    await expect(uploadFormFileAction('en', data)).resolves.toEqual({ ok: true, id: 'mock-upload-3', name: 'rx.png' });
    vi.mocked(uploadFile).mockRejectedValue(validation({ file: ['Upload a jpg, png, webp or pdf file.'] }));
    await expect(uploadFormFileAction('en', data)).resolves.toEqual({ ok: false, message: 'Upload a jpg, png, webp or pdf file.' });
    await expect(uploadFormFileAction('en', new FormData())).resolves.toEqual({ ok: false, message: 'The file could not be uploaded. Please try another file.' });
  });
});
