import { defineMessages } from './define';

/**
 * UI strings of the wallet page (EN + AR). The title, the balance, the entry titles, the amounts
 * and every checkout wallet text are the backend's.
 */
export const walletMessages = defineMessages({
  en: {
    walletTitle: 'My wallet',
    walletBalance: 'Balance',
    walletHistoryTitle: 'History',
    walletEmpty: 'No wallet activity yet.',
    walletPages: 'Wallet history pages',
    walletViewOrder: 'View order',
    walletLoadError: 'Your wallet could not be loaded. Please try again.',
    accountWalletLink: 'My wallet',
  },
  ar: {
    walletTitle: 'محفظتي',
    walletBalance: 'الرصيد',
    walletHistoryTitle: 'السجل',
    walletEmpty: 'لا توجد حركات في المحفظة بعد.',
    walletPages: 'صفحات سجل المحفظة',
    walletViewOrder: 'عرض الطلب',
    walletLoadError: 'تعذر تحميل محفظتك. يرجى المحاولة مرة أخرى.',
    accountWalletLink: 'محفظتي',
  },
});
