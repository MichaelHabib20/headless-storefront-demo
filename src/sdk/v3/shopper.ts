/**
 * Shopper endpoints (contract: contract/openapi.yaml). Every personal call needs the
 * shopper token (customer or guest). Frozen signatures — pages call these, never HTTP.
 */
import type { StorefrontClient } from './http';
import type { Cart, CompareData, GuestSession, ListState, Locale, Me, MoveToCartResult, NotificationsPage, WishlistPage } from './types';

interface Ctx {
  locale: Locale;
  token: string | null;
}

interface PageQuery {
  page?: number;
  perPage?: number;
}

// session
export const createGuestSession = (client: StorefrontClient, locale: Locale) =>
  client.request<GuestSession>('POST', 'session/guest', { locale });

export const getMe = (client: StorefrontClient, { locale, token }: Ctx) =>
  client.request<Me>('GET', 'me', { locale, token });

// cart
export const getCart = (client: StorefrontClient, ctx: Ctx) => client.request<Cart>('GET', 'cart', ctx);
export const clearCart = (client: StorefrontClient, ctx: Ctx) => client.request<Cart>('DELETE', 'cart', ctx);
export const setCartItem = (client: StorefrontClient, ctx: Ctx, productId: number, quantity: number) =>
  client.request<Cart>('PUT', `cart/items/${productId}`, { ...ctx, body: { quantity } });
export const removeCartItem = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<Cart>('DELETE', `cart/items/${productId}`, ctx);

// wishlist
export const getWishlist = (client: StorefrontClient, ctx: Ctx, { page, perPage }: PageQuery = {}) =>
  client.request<WishlistPage>('GET', 'wishlist', { ...ctx, query: { page, perPage } });
export const addToWishlist = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<ListState>('PUT', `wishlist/items/${productId}`, ctx);
export const removeFromWishlist = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<ListState>('DELETE', `wishlist/items/${productId}`, ctx);
export const moveWishlistItemToCart = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<MoveToCartResult>('POST', `wishlist/items/${productId}/move-to-cart`, ctx);

// compare
export const getCompare = (client: StorefrontClient, ctx: Ctx) => client.request<CompareData>('GET', 'compare', ctx);
export const addToCompare = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<ListState>('PUT', `compare/items/${productId}`, ctx);
export const removeFromCompare = (client: StorefrontClient, ctx: Ctx, productId: number) =>
  client.request<ListState>('DELETE', `compare/items/${productId}`, ctx);

// notifications
export const getNotifications = (client: StorefrontClient, ctx: Ctx, { page, perPage }: PageQuery = {}) =>
  client.request<NotificationsPage>('GET', 'notifications', { ...ctx, query: { page, perPage } });
export const markNotificationRead = (client: StorefrontClient, ctx: Ctx, notificationId: number) =>
  client.request<{ unreadCount: number }>('POST', `notifications/${notificationId}/read`, ctx);
export const markAllNotificationsRead = (client: StorefrontClient, ctx: Ctx) =>
  client.request<{ unreadCount: number }>('POST', 'notifications/read-all', ctx);

export type ShopperContext = Ctx;
