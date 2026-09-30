'use client';

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';
import type { Me } from '@/sdk';
import { productShopperState, type ProductShopperState, type ShopperFeatures } from './state';

type RunInOrder = <T>(write: () => Promise<T>) => Promise<T>;

interface ShopperStateValue {
  me: Me | null;
  features: ShopperFeatures;
  runInOrder: RunInOrder;
}

// Without a provider nothing is known: no list state, and feature-gated actions stay hidden.
const ShopperStateContext = createContext<ShopperStateValue>({
  me: null,
  features: { wishlist: false, compare: false },
  runInOrder: (write) => write(),
});

/**
 * Makes the shopper's `GET /me` (loaded once per request by the locale layout) available to
 * product cards. Server actions revalidate the layout, so this value is refreshed after every
 * cart / wishlist / compare change.
 *
 * Shopper writes from any card run one at a time (`runInOrder`). Without this, a visitor who
 * clicks two buttons quickly would have both first writes start their own guest session, and the
 * second session's cookie would orphan the first write (found by the live staging e2e run).
 */
export function ShopperStateProvider({ me, features, children }: { me: Me | null; features: ShopperFeatures; children: ReactNode }) {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const runInOrder = useCallback<RunInOrder>((write) => {
    const next = queue.current.then(write, write);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  const value = useMemo(() => ({ me, features, runInOrder }), [me, features, runInOrder]);
  return <ShopperStateContext.Provider value={value}>{children}</ShopperStateContext.Provider>;
}

export function useProductShopperState(productId: number): ProductShopperState & { features: ShopperFeatures } {
  const { me, features } = useContext(ShopperStateContext);
  return { ...productShopperState(me, productId), features };
}

/** Runs a shopper write after any write already in flight on this page. */
export function useRunInOrder(): RunInOrder {
  return useContext(ShopperStateContext).runInOrder;
}
