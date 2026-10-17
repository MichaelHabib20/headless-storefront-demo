import { describe, expect, it } from 'vitest';
import { checkFields, checkMessages, formTexts, unplacedErrors, type FieldCheck } from './form-checks';

const en = checkMessages('en');

describe('checkFields', () => {
  const checks: FieldCheck[] = [
    { name: 'firstName', required: true },
    { name: 'email', kind: 'email' },
    { name: 'phone', required: true, kind: 'phone', phoneLength: 11 },
    { name: 'password', required: true, kind: 'password', minLength: 8 },
    { name: 'passwordConfirmation', required: true, kind: 'password', sameAs: 'password' },
  ];

  it('answers every mistake at once', () => {
    expect(checkFields({ firstName: '  ', email: 'mona', phone: '01', password: '12', passwordConfirmation: '13' }, checks, en)).toEqual({
      firstName: 'This field is required.',
      email: 'Enter a valid e-mail address.',
      phone: 'Enter a 11-digit phone number.',
      password: 'Use at least 8 characters.',
      passwordConfirmation: 'The passwords do not match.',
    });
  });

  it('accepts a correct form, optional fields left empty, Arabic digits in the phone', () => {
    expect(checkFields({ firstName: 'Mona', email: '', phone: '٠١٠٠٠٠٠٠٠٠١', password: 'Secret123', passwordConfirmation: 'Secret123' }, checks, en)).toEqual({});
  });

  it('does not check the phone length when the store gives none', () => {
    expect(checkFields({ phone: '01' }, [{ name: 'phone', kind: 'phone', phoneLength: null }], en)).toEqual({});
  });

  it('speaks Arabic', () => {
    expect(checkFields({ password: 'x', passwordConfirmation: '' }, checks.slice(3), checkMessages('ar'))).toEqual({
      password: 'استخدم 8 أحرف على الأقل.',
      passwordConfirmation: 'هذا الحقل مطلوب.',
    });
  });
});

describe('formTexts / unplacedErrors', () => {
  it('reads the text values of a form', () => {
    const data = new FormData();
    data.set('a', 'one');
    data.append('a', 'two');
    data.set('file', new Blob(['x']), 'x.png');
    expect(formTexts(data)).toEqual({ a: 'one' });
  });

  it('keeps the server messages no input shows', () => {
    expect(unplacedErrors({ currentPassword: 'Wrong.', password: 'Too weak.' }, ['currentPassword'])).toEqual(['Too weak.']);
  });
});
