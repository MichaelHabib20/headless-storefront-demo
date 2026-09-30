/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { keepReorderNotice, takeReorderNotice } from './reorder-notice';
import { statusTone } from './status';

describe('statusTone (styling only)', () => {
  it('styles known codes and gives unknown codes the default look', () => {
    expect(statusTone('processing')).toBe('progress');
    expect(statusTone('delivered')).toBe('done');
    expect(statusTone('picked_up')).toBe('done');
    expect(statusTone('cancelled')).toBe('stopped');
    expect(statusTone('returned')).toBe('default');
    expect(statusTone('toString')).toBe('default');
  });
});

describe('reorder notice', () => {
  afterEach(() => window.sessionStorage.clear());

  it('is read once', () => {
    keepReorderNotice([{ name: 'Baby Wipes', reason: 'No longer sold.' }]);
    expect(takeReorderNotice()).toEqual([{ name: 'Baby Wipes', reason: 'No longer sold.' }]);
    expect(takeReorderNotice()).toBeNull();
  });

  it('ignores anything that is not a list of names and reasons', () => {
    window.sessionStorage.setItem('sc_reorder_notice', '{"x":1}');
    expect(takeReorderNotice()).toBeNull();
    window.sessionStorage.setItem('sc_reorder_notice', '[{"name":"A","reason":"B"},{"name":1},"x"]');
    expect(takeReorderNotice()).toEqual([{ name: 'A', reason: 'B' }]);
    window.sessionStorage.setItem('sc_reorder_notice', 'not json');
    expect(takeReorderNotice()).toBeNull();
  });
});
