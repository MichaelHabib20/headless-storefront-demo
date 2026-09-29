import { defineMessages } from './define';

/** UI strings for shopper. Owned by agent D (header counts, action buttons, session). Keep en and ar in sync. */
export const shopperMessages = defineMessages({
  en: {
    // Header icons. `{count}` is filled by countLabel(); the `One` forms are used for exactly 1.
    headerCompare: 'Compare',
    headerNotifications: 'Notifications',
    headerCartCount: 'Cart, {count} items',
    headerCartCountOne: 'Cart, 1 item',
    headerWishlistCount: 'Wishlist, {count} items',
    headerWishlistCountOne: 'Wishlist, 1 item',
    headerCompareCount: 'Compare, {count} products',
    headerCompareCountOne: 'Compare, 1 product',
    headerNotificationsCount: 'Notifications, {count} unread',
    headerNotificationsCountOne: 'Notifications, 1 unread',
    // Product card actions
    cardInCart: 'In cart ({count})',
    cardWishlist: 'Save to wishlist',
    cardCompare: 'Compare',
    // Action results (announced in the card's status region)
    statusAddedToCart: 'Added to cart.',
    statusAddedToWishlist: 'Saved to your wishlist.',
    statusRemovedFromWishlist: 'Removed from your wishlist.',
    statusAddedToCompare: 'Added to compare.',
    statusRemovedFromCompare: 'Removed from compare.',
    statusActionFailed: 'Something went wrong. Please try again.',
  },
  ar: {
    headerCompare: 'المقارنة',
    headerNotifications: 'الإشعارات',
    headerCartCount: 'السلة، عدد المنتجات: {count}',
    headerCartCountOne: 'السلة، منتج واحد',
    headerWishlistCount: 'المفضلة، عدد المنتجات: {count}',
    headerWishlistCountOne: 'المفضلة، منتج واحد',
    headerCompareCount: 'المقارنة، عدد المنتجات: {count}',
    headerCompareCountOne: 'المقارنة، منتج واحد',
    headerNotificationsCount: 'الإشعارات، غير المقروءة: {count}',
    headerNotificationsCountOne: 'الإشعارات، إشعار واحد غير مقروء',
    cardInCart: 'في السلة ({count})',
    cardWishlist: 'حفظ في المفضلة',
    cardCompare: 'قارن',
    statusAddedToCart: 'تمت الإضافة إلى السلة.',
    statusAddedToWishlist: 'تم الحفظ في المفضلة.',
    statusRemovedFromWishlist: 'تمت الإزالة من المفضلة.',
    statusAddedToCompare: 'تمت الإضافة إلى المقارنة.',
    statusRemovedFromCompare: 'تمت الإزالة من المقارنة.',
    statusActionFailed: 'حدث خطأ ما. حاول مرة أخرى.',
  },
});
