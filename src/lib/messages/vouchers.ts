import { defineMessages } from './define';

/**
 * UI strings of the vouchers page and the checkout voucher codes (EN + AR). The title, the tabs,
 * every voucher text and every refusal are the backend's.
 */
export const vouchersMessages = defineMessages({
  en: {
    vouchersTitle: 'My vouchers',
    vouchersAddTitle: 'Add a voucher',
    vouchersCodeLabel: 'Voucher code',
    vouchersAdd: 'Add',
    vouchersAdding: 'Adding…',
    vouchersAddFailed: 'We could not add this voucher. Please try again.',
    vouchersSignIn: 'Sign in to see your vouchers.',
    vouchersEmpty: 'No vouchers here.',
    vouchersTabs: 'Voucher status',
    vouchersCode: 'Code',
    vouchersRemaining: 'Remaining',
    vouchersOf: 'of',
    accountVouchersLink: 'My vouchers',
    checkoutVoucherSuggestions: 'Your vouchers',
  },
  ar: {
    vouchersTitle: 'قسائمي',
    vouchersAddTitle: 'أضف قسيمة',
    vouchersCodeLabel: 'كود القسيمة',
    vouchersAdd: 'إضافة',
    vouchersAdding: 'جارٍ الإضافة…',
    vouchersAddFailed: 'تعذّر إضافة هذه القسيمة. يرجى المحاولة مرة أخرى.',
    vouchersSignIn: 'سجّل الدخول لعرض قسائمك.',
    vouchersEmpty: 'لا توجد قسائم هنا.',
    vouchersTabs: 'حالة القسيمة',
    vouchersCode: 'الكود',
    vouchersRemaining: 'المتبقي',
    vouchersOf: 'من',
    accountVouchersLink: 'قسائمي',
    checkoutVoucherSuggestions: 'قسائمك',
  },
});
