import { defineMessages } from './define';

/** UI strings for wishlist. Owned by agent F (wishlist + compare). Keep en and ar in sync. */
export const wishlistMessages = defineMessages({
  en: {
    wishlistTitle: 'My wishlist',
    wishlistCount: 'Saved items: {count}',
    wishlistEmptyTitle: 'Your wishlist is empty',
    wishlistEmptyText: 'Save the products you love and find them here any time.',
    wishlistStartShopping: 'Start shopping',
    wishlistRemove: 'Remove',
    wishlistMoveToCart: 'Move to cart',
    wishlistRemoved: 'Removed from your wishlist.',
    wishlistMoved: 'Moved to your cart.',
    wishlistViewCart: 'View cart',
    wishlistActionError: 'We could not update your wishlist. Please try again.',
    wishlistLoadError: 'We could not load your wishlist. Please try again in a moment.',
    wishlistPages: 'Wishlist pages',
    wishlistPage: 'Page',
  },
  ar: {
    wishlistTitle: 'قائمة المفضلة',
    wishlistCount: 'المنتجات المحفوظة: {count}',
    wishlistEmptyTitle: 'قائمة المفضلة فارغة',
    wishlistEmptyText: 'احفظ المنتجات التي تعجبك وستجدها هنا في أي وقت.',
    wishlistStartShopping: 'ابدأ التسوق',
    wishlistRemove: 'إزالة',
    wishlistMoveToCart: 'نقل إلى السلة',
    wishlistRemoved: 'تمت الإزالة من المفضلة.',
    wishlistMoved: 'تم نقل المنتج إلى السلة.',
    wishlistViewCart: 'عرض السلة',
    wishlistActionError: 'تعذر تحديث المفضلة. حاول مرة أخرى.',
    wishlistLoadError: 'تعذر تحميل المفضلة. حاول مرة أخرى بعد قليل.',
    wishlistPages: 'صفحات المفضلة',
    wishlistPage: 'صفحة',
  },
});
