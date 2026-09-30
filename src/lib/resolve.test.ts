import { describe, expect, it } from 'vitest';
import type { Resolution } from '@/sdk';
import { answerForResolution } from './resolve';

const requested = new URL('http://shop.test/en/old-path?x=1');
const answer = (resolution: Partial<Resolution>, url = requested) =>
  answerForResolution({ result: 'not_found', target: null, url: null, permanent: false, ...resolution }, 'en', url);

describe('answers for unknown paths', () => {
  it('a known target is a permanent redirect to our own URL of it', () => {
    expect(answer({ result: 'target', target: { type: 'product', slug: 'jj-bath' } })).toEqual({ kind: 'redirect', location: '/en/p/jj-bath', status: 301 });
    expect(answerForResolution({ result: 'target', target: { type: 'deals' }, url: null, permanent: false }, 'ar', requested)).toEqual({ kind: 'redirect', location: '/ar/deals', status: 301 });
  });

  it('a redirect follows its target or its url, permanent or not as told', () => {
    expect(answer({ result: 'redirect', target: { type: 'deals' }, permanent: false })).toEqual({ kind: 'redirect', location: '/en/deals', status: 302 });
    expect(answer({ result: 'redirect', url: 'https://blog.example.com/a', permanent: true })).toEqual({ kind: 'redirect', location: 'https://blog.example.com/a', status: 301 });
    expect(answer({ result: 'redirect', url: '/en/c/skin-care?sort=x', permanent: false })).toEqual({ kind: 'redirect', location: '/en/c/skin-care?sort=x', status: 302 });
  });

  it('gone and not_found', () => {
    expect(answer({ result: 'gone' })).toEqual({ kind: 'gone' });
    expect(answer({ result: 'not_found' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'something_new' as Resolution['result'] })).toEqual({ kind: 'not_found' });
  });

  it('never loops: a destination on this site must be one of our routes and not the same path', () => {
    expect(answer({ result: 'redirect', url: '/en/old-path?x=1' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'redirect', url: '/en/another-unknown' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'redirect', url: 'http://shop.test/en/another-unknown' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'redirect', url: 'http://shop.test/en/deals' })).toEqual({ kind: 'redirect', location: '/en/deals', status: 302 });
  });

  it('never follows unsafe or unusable destinations', () => {
    expect(answer({ result: 'redirect', target: { type: 'url', url: 'javascript:alert(1)' } })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'redirect', url: 'mailto:a@b.test' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'target', target: null })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'redirect' })).toEqual({ kind: 'not_found' });
    expect(answer({ result: 'target', target: { type: 'gift_card', slug: 'x' } as unknown as Resolution['target'] })).toEqual({ kind: 'not_found' });
  });
});
