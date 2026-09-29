'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Me } from '@/sdk';
import { productShopperState, type ProductShopperState, type ShopperFeatures } from './state';

interface ShopperStateValue {
  me: Me | null;
  features: ShopperFeatures;
}

// Without a provider nothing is known: no list state, and feature-gated actions stay hidden.
const ShopperStateContext = createContext<ShopperStateValue>({ me: null, features: { wishlist: false, compare: false } });

/**
 * Makes the shopper's `GET /me` (loaded once per request by the locale layout) available to
 * product cards. Server actions revalidate the layout, so this value is refreshed after every
 * cart / wishlist / compare change.
 */
export function ShopperStateProvider({ me, features, children }: { me: Me | null; features: ShopperFeatures; children: ReactNode }) {
  const value = useMemo(() => ({ me, features }), [me, features]);
  return <ShopperStateContext.Provider value={value}>{children}</ShopperStateContext.Provider>;
}

export function useProductShopperState(productId: number): ProductShopperState & { features: ShopperFeatures } {
  const { me, features } = useContext(ShopperStateContext);
  return { ...productShopperState(me, productId), features };
}
