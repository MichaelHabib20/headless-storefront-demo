import { describe, expect, it } from 'vitest';
import { formFields, listingHref, listingPageHref, swatchColor, toSearchParams } from './listing';

describe('listing links', () => {
  it('puts the backend query after the page path as it is', () => {
    expect(listingHref('/en/c/skin-care', 'brands=a%2Cb&sort=price_asc')).toBe('/en/c/skin-care?brands=a%2Cb&sort=price_asc');
    expect(listingHref('/en/deals', '')).toBe('/en/deals');
    expect(listingHref('/en/deals', '?sort=x')).toBe('/en/deals?sort=x');
  });

  it('keeps the search text first on the search page', () => {
    expect(listingHref('/ar/search', 'inStock=true', { q: 'بيبي' })).toBe('/ar/search?q=%D8%A8%D9%8A%D8%A8%D9%8A&inStock=true');
    expect(listingHref('/en/search', '', { q: 'bath' })).toBe('/en/search?q=bath');
  });

  it('changes only the page on page links', () => {
    expect(listingPageHref('/en/search', 'q=bath&options=1&options=2', 3)).toBe('/en/search?q=bath&options=1&options=2&page=3');
    expect(listingPageHref('/en/deals', 'page=3&sort=x', 2)).toBe('/en/deals?page=2&sort=x');
    expect(listingPageHref('/en/deals', 'page=3&sort=x', 1)).toBe('/en/deals?sort=x');
    expect(listingPageHref('/en/deals', '', 1)).toBe('/en/deals');
  });

  it('reads the page parameters with repeated values', () => {
    expect(toSearchParams({ a: '1', b: ['2', '3'], c: undefined }).toString()).toBe('a=1&b=2&b=3');
    expect(toSearchParams(new URLSearchParams('x=1')).toString()).toBe('x=1');
  });

  it('turns the range query into hidden fields, the page parameters first', () => {
    expect(formFields('brands=a&sort=price_asc', { q: 'bath' })).toEqual([
      ['q', 'bath'],
      ['brands', 'a'],
      ['sort', 'price_asc'],
    ]);
    expect(formFields('')).toEqual([]);
  });

  it('draws only plain CSS colors as swatches', () => {
    expect(swatchColor('#b39ddb')).toBe('#b39ddb');
    expect(swatchColor('navy')).toBe('navy');
    expect(swatchColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(swatchColor('url(https://x.test/a.png)')).toBeNull();
    expect(swatchColor('red;background:url(x)')).toBeNull();
    expect(swatchColor(null)).toBeNull();
  });
});
