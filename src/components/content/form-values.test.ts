import { describe, expect, it } from 'vitest';
import { fileFormFixture, merchantFormFixture } from '@/test/shell-fixtures';
import { checkForm, formValues, inputAttributes, mustFill, textValues } from './form-values';

describe('backend form values', () => {
  const fields = merchantFormFixture('en').fields;

  it('reads one value per described field, under its name; lists for multi-selects; nothing else', () => {
    const data = new FormData();
    data.set('v.firstName', '  Mona ');
    data.set('v.phone', '0100');
    data.set('v.email', '');
    data.set('v.field1', 'obour');
    data.append('v.field2', 'prices');
    data.append('v.field2', 'service');
    data.set('v.field4', 'mock-upload-1');
    data.set('v.notify_emails', 'x@y.z');
    data.set('role', 'admin');

    expect(formValues(fields, data)).toEqual({ firstName: 'Mona', phone: '0100', field1: 'obour', field2: ['prices', 'service'], field4: 'mock-upload-1' });
  });

  it('text values only (contact messages)', () => {
    expect(textValues({ name: 'A', topics: ['x'] })).toEqual({ name: 'A' });
  });

  const messages = { required: 'Required.', attach: 'Attach.', email: 'Email.', empty: 'Empty.' };

  it('checks before sending: every empty field to fill and a malformed e-mail, at once', () => {
    const data = new FormData();
    data.set('v.phone', '0100');
    data.set('v.email', 'not-an-email');
    expect(checkForm(fields, data, messages)).toEqual({ fieldErrors: { firstName: 'Required.', email: 'Email.', field1: 'Required.', field3: 'Required.' } });
  });

  it('a form with only optional fields is not sent empty', () => {
    const optional = fields.map((field) => ({ ...field, required: false }));
    expect(checkForm(optional, new FormData(), messages)).toEqual({ message: 'Empty.' });
    const data = new FormData();
    data.set('v.field3', 'Hi');
    expect(checkForm(optional, data, messages)).toEqual({});
  });

  it('the only field of a form must be filled; a file asks for an attachment', () => {
    const [upload] = fileFormFixture('en').fields.map((field) => ({ ...field, required: false }));
    expect(mustFill(upload, [upload])).toBe(true);
    expect(mustFill(upload, [upload, upload])).toBe(false);
    expect(checkForm([upload], new FormData(), messages)).toEqual({ fieldErrors: { field1: 'Attach.' } });
  });

  it('input types by kind; unknown kinds are text', () => {
    expect(inputAttributes('phone')).toMatchObject({ type: 'tel', inputMode: 'tel' });
    expect(inputAttributes('email')).toMatchObject({ type: 'email' });
    expect(inputAttributes('date')).toEqual({ type: 'date' });
    expect(inputAttributes('hologram')).toEqual({ type: 'text' });
  });
});
