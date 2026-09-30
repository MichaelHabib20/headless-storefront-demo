/**
 * Public v3 types, generated from contract/openapi.yaml (`npm run contract:types`).
 * Never edit src/sdk/generated/api.ts by hand.
 */
import type { components } from '../generated/api';

type Schemas = components['schemas'];

export type Locale = Schemas['Locale'];
export type Target = Schemas['Target'];
export type TargetType = Target['type'];
export type Layout = Schemas['Layout'];
export type NavItem = Schemas['NavItem'];
export type Link = Schemas['Link'];
export type Home = Schemas['Home'];
export type Section = Schemas['Section'];
export type SectionLayout = Schemas['SectionLayout'];
export type Banner = Schemas['Banner'];
export type PromoBanner = Schemas['PromoBanner'];
export type Popup = Schemas['Popup'];
export type Tile = Schemas['Tile'];
export type ProductCard = Schemas['ProductCard'];
export type Price = Schemas['Price'];
export type ResponsiveImage = Schemas['ResponsiveImage'];
export type Image = Schemas['Image'];

// shopper
export type Money = Schemas['Money'];
export type Pagination = Schemas['Pagination'];
export type GuestSession = Schemas['GuestSessionResponse']['data'];
export type Me = Schemas['Me'];
export type Cart = Schemas['Cart'];
export type CartItem = Schemas['CartItem'];
export type CartItemAvailability = Schemas['CartItemAvailability'];
export type CheckoutBlocker = Schemas['Cart']['checkout']['blockers'][number];
export type ListState = Schemas['ListState'];
export type WishlistPage = Schemas['WishlistResponse']['data'];
export type CompareData = Schemas['CompareResponse']['data'];
export type Notification = Schemas['Notification'];
export type NotificationsPage = Schemas['NotificationsResponse']['data'];
export type MoveToCartResult = { cart: Cart; wishlist: ListState };

// shared by the shopping pages
export type RichText = Schemas['RichText'];
export type Seo = Schemas['Seo'];

// store settings for checkout and addresses
export type CheckoutSettings = Schemas['CheckoutSettings'];
export type AddressFormField = CheckoutSettings['addressForm']['fields'][number];
export type Locations = Schemas['LocationsResponse']['data'];

// product page
export type ProductDetails = Schemas['ProductDetails'];
export type ProductOption = Schemas['ProductOption'];
export type ProductOptionValue = ProductOption['values'][number];
export type ProductAvailability = Schemas['ProductAvailability'];
export type ProductNotice = ProductDetails['notices'][number];
export type ProductSpecification = ProductDetails['specifications'][number];
export type ProductVideo = NonNullable<ProductDetails['video']>;
export type ProductRecommendations = Schemas['ProductRecommendationsResponse']['data'];
export type RecommendationSection = ProductRecommendations['sections'][number];
export type ProductReviewsPage = Schemas['ProductReviewsResponse']['data'];
export type ProductReview = ProductReviewsPage['items'][number];
export type ReviewSummary = NonNullable<ProductReviewsPage['summary']>;
export type NotifyMeResult = import('../generated/api').operations['notifyWhenAvailable']['responses'][200]['content']['application/json']['data'];

export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}
