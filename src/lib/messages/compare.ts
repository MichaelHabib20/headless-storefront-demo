import { defineMessages } from './define';

/** UI strings for compare. Owned by agent F (wishlist + compare). Keep en and ar in sync. */
export const compareMessages = defineMessages({
  en: {
    compareTitle: 'Compare products',
    compareNote: 'Comparing {count} of {max} products',
    compareNoteUnlimited: 'Products compared: {count}',
    compareEmptyTitle: 'Nothing to compare yet',
    compareEmptyText: 'Add products to compare their details side by side.',
    compareStartShopping: 'Start shopping',
    compareRemove: 'Remove',
    compareRemoved: 'Removed from compare.',
    compareActionError: 'We could not update the comparison. Please try again.',
    compareLoadError: 'We could not load the comparison. Please try again in a moment.',
    compareTableLabel: 'Product comparison',
    compareProduct: 'Product',
    compareNoValue: 'No value',
  },
  ar: {
    compareTitle: 'مقارنة المنتجات',
    compareNote: 'مقارنة {count} من {max} منتجات',
    compareNoteUnlimited: 'المنتجات في المقارنة: {count}',
    compareEmptyTitle: 'لا توجد منتجات للمقارنة',
    compareEmptyText: 'أضف منتجات لمقارنة تفاصيلها جنبًا إلى جنب.',
    compareStartShopping: 'ابدأ التسوق',
    compareRemove: 'إزالة',
    compareRemoved: 'تمت الإزالة من المقارنة.',
    compareActionError: 'تعذر تحديث المقارنة. حاول مرة أخرى.',
    compareLoadError: 'تعذر تحميل المقارنة. حاول مرة أخرى بعد قليل.',
    compareTableLabel: 'جدول مقارنة المنتجات',
    compareProduct: 'المنتج',
    compareNoValue: 'لا توجد قيمة',
  },
});
