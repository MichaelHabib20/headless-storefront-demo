import { describe, expect, it } from 'vitest';
import { anonymousMeFixture, meFixture } from '@/test/fixtures';
import { productShopperState } from './state';

describe('productShopperState', () => {
  it('reads cart quantity, wishlist and compare membership from Me', () => {
    const me = meFixture('en');
    expect(productShopperState(me, 36480)).toEqual({ cartQuantity: 2, inWishlist: false, inCompare: true });
    expect(productShopperState(me, 8412)).toEqual({ cartQuantity: 0, inWishlist: true, inCompare: true });
    expect(productShopperState(me, 9822)).toEqual({ cartQuantity: 0, inWishlist: false, inCompare: false });
  });

  it('knows nothing for anonymous visitors or when Me failed', () => {
    const empty = { cartQuantity: 0, inWishlist: false, inCompare: false };
    expect(productShopperState(anonymousMeFixture(), 36480)).toEqual(empty);
    expect(productShopperState(null, 36480)).toEqual(empty);
  });
});
