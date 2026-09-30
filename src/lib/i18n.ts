import type { Locale } from '@/sdk';
import { cartMessages } from './messages/cart';
import { catalogMessages } from './messages/catalog';
import { compareMessages } from './messages/compare';
import { notificationsMessages } from './messages/notifications';
import { productMessages } from './messages/product';
import { shopperMessages } from './messages/shopper';
import { wishlistMessages } from './messages/wishlist';

/**
 * UI strings owned by the storefront (buttons, headings, labels). Content text
 * (section titles, menu labels, banners) comes from the API already translated.
 */
const en = {
  skipToContent: 'Skip to content',
  menu: 'Menu',
  closeMenu: 'Close menu',
  search: 'Search',
  searchPlaceholder: 'Search products and brands',
  account: 'Account',
  signIn: 'Sign in',
  wishlist: 'Wishlist',
  cart: 'Cart',
  language: 'العربية',
  languageLabel: 'Switch language',
  hotline: 'Hotline',
  shopNow: 'Shop now',
  viewAll: 'View all',
  shopByCategory: 'Shop by category',
  brands: 'Brands',
  previous: 'Previous',
  next: 'Next',
  addToCart: 'Add to cart',
  outOfStock: 'Out of stock',
  prescription: 'Prescription required',
  preorder: 'Pre-order',
  comingSoonBadge: 'Coming soon',
  off: 'off',
  reviews: 'reviews',
  footerAbout: 'About',
  footerHelp: 'Help',
  footerAccount: 'My account',
  footerFollow: 'Follow us',
  footerApps: 'Get the app',
  myOrders: 'My orders',
  trackOrder: 'Track order',
  contactUs: 'Contact us',
  branches: 'Branches',
  newsletterTitle: 'Stay in the loop',
  newsletterEmail: 'Email address',
  newsletterSubmit: 'Subscribe',
  newsletterSoon: 'Newsletter sign-up is coming soon.',
  cookieText: 'We use cookies to run the store and to improve your experience.',
  cookieAccept: 'Accept',
  close: 'Close',
  chatOnWhatsapp: 'Chat on WhatsApp',
  comingSoonTitle: 'Coming soon',
  comingSoonText: 'This page is part of the new storefront and is not built yet.',
  backHome: 'Back to home',
  notFoundTitle: 'Page not found',
  errorTitle: 'The store is taking a break',
  errorText: 'We could not load this page. Please try again in a moment.',
  tryAgain: 'Try again',
  androidApp: 'Get it on Google Play',
  iosApp: 'Download on the App Store',
  huaweiApp: 'Explore it on AppGallery',
  rights: 'All rights reserved.',
};

const coreAr: Record<keyof typeof en, string> = {
  skipToContent: 'تخطى إلى المحتوى',
  menu: 'القائمة',
  closeMenu: 'إغلاق القائمة',
  search: 'بحث',
  searchPlaceholder: 'ابحث عن المنتجات والماركات',
  account: 'الحساب',
  signIn: 'تسجيل الدخول',
  wishlist: 'المفضلة',
  cart: 'السلة',
  language: 'English',
  languageLabel: 'تغيير اللغة',
  hotline: 'الخط الساخن',
  shopNow: 'تسوق الآن',
  viewAll: 'عرض الكل',
  shopByCategory: 'تسوق حسب الفئة',
  brands: 'الماركات',
  previous: 'السابق',
  next: 'التالي',
  addToCart: 'أضف إلى السلة',
  outOfStock: 'غير متوفر',
  prescription: 'يتطلب وصفة طبية',
  preorder: 'طلب مسبق',
  comingSoonBadge: 'قريباً',
  off: 'خصم',
  reviews: 'تقييمات',
  footerAbout: 'عن المتجر',
  footerHelp: 'المساعدة',
  footerAccount: 'حسابي',
  footerFollow: 'تابعنا',
  footerApps: 'حمّل التطبيق',
  myOrders: 'طلباتي',
  trackOrder: 'تتبع الطلب',
  contactUs: 'اتصل بنا',
  branches: 'الفروع',
  newsletterTitle: 'ابقَ على اطلاع',
  newsletterEmail: 'البريد الإلكتروني',
  newsletterSubmit: 'اشترك',
  newsletterSoon: 'الاشتراك في النشرة البريدية قريباً.',
  cookieText: 'نستخدم ملفات تعريف الارتباط لتشغيل المتجر وتحسين تجربتك.',
  cookieAccept: 'موافق',
  close: 'إغلاق',
  chatOnWhatsapp: 'تواصل عبر واتساب',
  comingSoonTitle: 'قريباً',
  comingSoonText: 'هذه الصفحة جزء من المتجر الجديد ولم يتم بناؤها بعد.',
  backHome: 'العودة للرئيسية',
  notFoundTitle: 'الصفحة غير موجودة',
  errorTitle: 'المتجر في استراحة قصيرة',
  errorText: 'تعذر تحميل هذه الصفحة. حاول مرة أخرى بعد قليل.',
  tryAgain: 'حاول مرة أخرى',
  androidApp: 'متاح على جوجل بلاي',
  iosApp: 'حمّل من آب ستور',
  huaweiApp: 'متاح على آب جاليري',
  rights: 'جميع الحقوق محفوظة.',
};

/*
 * Each area owns its strings in src/lib/messages/<area>.ts ({en, ar} with the same keys,
 * enforced by defineMessages). Add new areas here.
 */
const dictionaries = {
  en: { ...en, ...cartMessages.en, ...wishlistMessages.en, ...compareMessages.en, ...notificationsMessages.en, ...shopperMessages.en, ...productMessages.en, ...catalogMessages.en },
  ar: { ...coreAr, ...cartMessages.ar, ...wishlistMessages.ar, ...compareMessages.ar, ...notificationsMessages.ar, ...shopperMessages.ar, ...productMessages.ar, ...catalogMessages.ar },
} satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof typeof dictionaries.en;

export type Translator = (key: MessageKey) => string;

export function translator(locale: Locale): Translator {
  const dictionary = dictionaries[locale];
  return (key) => dictionary[key];
}

export function direction(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

export const messagesForTest = dictionaries;
