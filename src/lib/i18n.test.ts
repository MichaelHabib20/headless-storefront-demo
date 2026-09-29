import { describe, expect, it } from 'vitest';
import { direction, messagesForTest, translator } from './i18n';

describe('i18n', () => {
  it('has every UI string in both languages', () => {
    const en = Object.keys(messagesForTest.en).sort();
    const ar = Object.keys(messagesForTest.ar).sort();
    expect(ar).toEqual(en);
    for (const [key, value] of Object.entries(messagesForTest.ar)) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('translates and sets direction', () => {
    expect(translator('ar')('viewAll')).toBe('عرض الكل');
    expect(direction('ar')).toBe('rtl');
    expect(direction('en')).toBe('ltr');
  });
});
