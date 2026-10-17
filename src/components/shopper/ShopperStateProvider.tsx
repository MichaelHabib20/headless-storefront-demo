'use client';

import { useRouter } from 'next/navigation';
import { createContext, startTransition, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Me } from '@/sdk';
import { productShopperState, type ProductShopperState, type ShopperFeatures } from './state';

type RunInOrder = <T>(write: () => Promise<T>) => Promise<T>;

interface ShopperStateValue {
  /** Inside the provider: the counts are the latest `GET /me` this page knows (see `cartChanged`). */
  live: boolean;
  me: Me | null;
  features: ShopperFeatures;
  runInOrder: RunInOrder;
  /**
   * After a cart write the backend accepted: shows the `GET /me` the action read after it (header and
   * card counts at once), then refreshes the page in the background once no write is waiting, unless
   * the action's answer already carried the re-rendered page (`rendered`: it started the guest session).
   */
  cartChanged: (me: Me | null | undefined, rendered?: boolean) => void;
}

// Without a provider nothing is known: no list state, and feature-gated actions stay hidden.
const ShopperStateContext = createContext<ShopperStateValue>({
  live: false,
  me: null,
  features: { wishlist: false, compare: false },
  runInOrder: (write) => write(),
  cartChanged: () => undefined,
});

/**
 * Makes the shopper's `GET /me` (loaded once per request by the locale layout) available to the
 * header badges and product cards. Wishlist / compare actions revalidate the layout, so this value is
 * refreshed after them. Add to cart does not wait for a re-render of the whole page: its action
 * answers with `GET /me` read right after the write (shown at once), and the page is refreshed in the
 * background afterwards (`router.refresh()`), so every server-rendered part ends up as before.
 *
 * Shopper writes from any card run one at a time (`runInOrder`). Without this, a visitor who
 * clicks two buttons quickly would have both first writes start their own guest session, and the
 * second session's cookie would orphan the first write (found by the live staging e2e run).
 */
export function ShopperStateProvider({ me: serverMe, features, children }: { me: Me | null; features: ShopperFeatures; children: ReactNode }) {
  const router = useRouter();
  const [me, setMe] = useState(serverMe);
  const [seen, setSeen] = useState(serverMe);
  if (seen !== serverMe) {
    // A new render from the server (navigation, refresh, revalidated action) is the truth again.
    setSeen(serverMe);
    setMe(serverMe);
  }

  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef(0);
  const refreshWanted = useRef(false);

  const refreshWhenIdle = useCallback(() => {
    // After the current tasks: the write that just ended has left the queue by then.
    setTimeout(() => {
      if (!refreshWanted.current || waiting.current > 0) return;
      refreshWanted.current = false;
      startTransition(() => router.refresh());
    }, 0);
  }, [router]);

  const runInOrder = useCallback<RunInOrder>(
    (write) => {
      waiting.current++;
      const next = queue.current.then(write, write);
      queue.current = next
        .catch(() => undefined)
        .finally(() => {
          waiting.current--;
          refreshWhenIdle();
        });
      return next;
    },
    [refreshWhenIdle],
  );

  const cartChanged = useCallback(
    (latest: Me | null | undefined, rendered = false) => {
      if (latest) setMe(latest);
      if (rendered) return;
      refreshWanted.current = true;
      refreshWhenIdle();
    },
    [refreshWhenIdle],
  );

  const value = useMemo(() => ({ live: true, me, features, runInOrder, cartChanged }), [me, features, runInOrder, cartChanged]);
  return <ShopperStateContext.Provider value={value}>{children}</ShopperStateContext.Provider>;
}

export function useProductShopperState(productId: number): ProductShopperState & { features: ShopperFeatures } {
  const { me, features } = useContext(ShopperStateContext);
  return { ...productShopperState(me, productId), features };
}

/** The latest `GET /me` inside the provider; outside it (tests, pages without the layout) the given one. */
export function useShopperMe<T extends Pick<Me, 'counts'> | null | undefined>(
  fallback: T,
): Me | null | T {
  const { live, me } = useContext(ShopperStateContext);
  return live ? me : fallback;
}

/** Runs a shopper write after any write already in flight on this page. */
export function useRunInOrder(): RunInOrder {
  return useContext(ShopperStateContext).runInOrder;
}

/** See `ShopperStateValue.cartChanged`. */
export function useCartChanged(): ShopperStateValue['cartChanged'] {
  return useContext(ShopperStateContext).cartChanged;
}
