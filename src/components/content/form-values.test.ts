import { describe, expect, it } from 'vitest';
import { merchantFormFixture } from '@/test/shell-fixtures';
import { formValues, inputAttributes, textValues } from './form-values';

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

  it('input types by kind; unknown kinds are text', () => {
    expect(inputAttributes('phone')).toMatchObject({ type: 'tel', inputMode: 'tel' });
    expect(inputAttributes('email')).toMatchObject({ type: 'email' });
    expect(inputAttributes('date')).toEqual({ type: 'date' });
    expect(inputAttributes('hologram')).toEqual({ type: 'text' });
  });
});
