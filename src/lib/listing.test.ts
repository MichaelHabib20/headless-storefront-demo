import { describe, expect, it } from 'vitest';
import { PRICE_FIELDS, formFields, listingHref, listingPageHref, swatchColor, toApiParams, toOldQuery, toSearchParams } from './listing';

describe('listing links', () => {
  it('puts the backend query after the page path, in the old storefront names', () => {
    expect(listingHref('/en/product/skin-care', 'brands=a%2Cb&sort=price_asc')).toBe('/en/product/skin-care?brand_id=a&brand_id=b&sort=low');
    expect(listingHref('/en/products/deals', '')).toBe('/en/products/deals');
    expect(listingHref('/en/products/deals', '?sort=x')).toBe('/en/products/deals?sort=x');
  });

  it('keeps the search text first on the search page', () => {
    expect(listingHref('/ar/products', 'inStock=true', { search: 'بيبي' })).toBe('/ar/products?search=%D8%A8%D9%8A%D8%A8%D9%8A&in_stock=1');
    expect(listingHref('/en/products', '', { search: 'bath' })).toBe('/en/products?search=bath');
  });

  it('changes only the page on page links', () => {
    expect(listingPageHref('/en/products', 'search=bath&options_values_ids=1&options_values_ids=2', 3)).toBe('/en/products?search=bath&options_values_ids=1&options_values_ids=2&page=3');
    expect(listingPageHref('/en/products/deals', 'page=3&sort=x', 2)).toBe('/en/products/deals?page=2&sort=x');
    // a page opened with the v3 names gets page links in the old ones
    expect(listingPageHref('/en/products', 'options=1%2C2&priceMin=10', 2)).toBe('/en/products?options_values_ids=1&options_values_ids=2&price_from=10&page=2');
    expect(listingPageHref('/en/products/deals', 'page=3&sort=x', 1)).toBe('/en/products/deals?sort=x');
    expect(listingPageHref('/en/products/deals', '', 1)).toBe('/en/products/deals');
  });

  it('reads the page parameters with repeated values', () => {
    expect(toSearchParams({ a: '1', b: ['2', '3'], c: undefined }).toString()).toBe('a=1&b=2&b=3');
    expect(toSearchParams(new URLSearchParams('x=1')).toString()).toBe('x=1');
  });

  it('turns the range query into hidden fields, the page parameters first', () => {
    expect(formFields('brands=a&sort=price_asc', { search: 'bath' })).toEqual([
      ['search', 'bath'],
      ['brand_id', 'a'],
      ['sort', 'low'],
    ]);
    expect(formFields('')).toEqual([]);
    expect(PRICE_FIELDS).toEqual({ min: 'price_from', max: 'price_to' });
  });

  it('writes the old storefront names: repeated multi-values, in_stock=1, price_from/to, old sort keys', () => {
    expect(toOldQuery('brands=bioderma%2Cvichy&categories=face-care&options=3%2C4&inStock=true&priceMin=10&priceMax=99.5&sort=price_desc')).toBe(
      'brand_id=bioderma&brand_id=vichy&sub_category_id=face-care&options_values_ids=3&options_values_ids=4&in_stock=1&price_from=10&price_to=99.5&sort=high',
    );
    for (const [v3, old] of [['popular', 'popular'], ['name_asc', 'a-z'], ['name_desc', 'z-a'], ['price_asc', 'low'], ['rating_asc', 'low-rate'], ['rating_desc', 'high-rate'], ['discount_desc', 'high-discount'], ['newest', 'recent']]) {
      expect(toOldQuery(`sort=${v3}`)).toBe(`sort=${old}`);
    }
    // no old key: kept; old names, page and the rest: as they are
    expect(toOldQuery('sort=featured&page=2&search=a+b&category_id=5')).toBe('sort=featured&page=2&search=a+b&category_id=5');
    expect(toOldQuery('?inStock=false&brand_id=758')).toBe('brand_id=758');
    expect(toOldQuery(new URLSearchParams('categories=mom-baby%2Fbaby-care'))).toBe('sub_category_id=mom-baby%2Fbaby-care');
  });

  it('sends the API its own names, from the old names or the v3 ones', () => {
    const api = (query: string) => toApiParams(new URLSearchParams(query)).toString();
    expect(api('brand_id=bioderma&brand_id=vichy&sub_category_id=face-care&options_values_ids=3&options_values_ids=4&in_stock=1&price_from=10&price_to=99.5&sort=high&page=2')).toBe(
      'brands=bioderma%2Cvichy&categories=face-care&options=3%2C4&inStock=true&priceMin=10&priceMax=99.5&sort=price_desc&page=2',
    );
    // round trip: the API's query → a link → the API's query again
    const v3 = 'brands=a%2Cb&options=1%2C2&inStock=true&priceMin=5&sort=price_asc';
    expect(api(toOldQuery(v3))).toBe(v3);
    // the v3 names still work, and win over the old ones
    expect(api('brands=x&brand_id=y&priceMin=5&price_from=10&inStock=true&in_stock=0&sort=price_desc')).toBe('brands=x&priceMin=5&inStock=true&sort=price_desc');
    expect(api('options=1,2&attribute_id=9')).toBe('options=1%2C2');
    // old ids (bookmarks, menus) stay for the backend, which turns them into slugs and scopes
    expect(api('brand_id=758&brand_id=759&sub_category_id=91&category_id=5')).toBe('brand_id=758&brand_id=759&sub_category_id=91&category_id=5');
    expect(api('sub_category_id=91&sub_category_id=baby-care')).toBe('sub_category_id=91&categories=baby-care');
    expect(api('attribute_id=7&in_stock=0&sort=recent')).toBe('options=7&sort=newest');
    // values the backend must refuse still reach it
    expect(api('price_from=abc')).toBe('priceMin=abc');
    expect(api('sort=whatever&search=bath')).toBe('sort=whatever&search=bath');
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
