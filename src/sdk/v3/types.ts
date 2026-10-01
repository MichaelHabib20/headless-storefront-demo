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
// checkout and its result page
export type CheckoutSelections = Schemas['CheckoutSelections'];
export type Checkout = Schemas['Checkout'];
export type CheckoutContact = Schemas['CheckoutContact'];
export type CheckoutNotice = Schemas['CheckoutNotice'];
export type CheckoutMessage = Checkout['messages'][number];
export type CheckoutTotalLine = Schemas['TotalLine'];
export type CheckoutFulfilmentOption = Checkout['fulfilment']['options'][number];
export type CheckoutAddress = Checkout['fulfilment']['addresses'][number];
export type CheckoutPaymentMethod = Checkout['payment']['methods'][number];
export type PickupBranch = Schemas['PickupBranch'];
export type UploadedFile = Schemas['UploadedFile'];
export type PlaceOrderResult = Schemas['PlaceOrderResponse']['data'];
export type CheckoutResult = Schemas['CheckoutResultResponse']['data'];
export type CheckoutOrder = NonNullable<CheckoutResult['order']>;
// address book and orders (account pages)
export type Address = Schemas['Address'];
export type AddressInput = Schemas['AddressInput'];
export type AddressBook = Schemas['AddressesResponse']['data'];
export type AddressSaved = Schemas['AddressSavedResponse']['data'];
export type OrderStatus = Schemas['OrderStatus'];
export type OrderSummary = Schemas['OrderSummary'];
export type OrdersPage = Schemas['OrdersResponse']['data'];
export type Order = Schemas['Order'];
export type OrderItem = Order['items'][number];
export type TotalLine = Schemas['TotalLine'];
export type CancellationReason = Schemas['CancellationReasonsResponse']['data']['items'][number];
export type CancellationReasons = Schemas['CancellationReasonsResponse']['data'];
export type CancelOrderInput = { reasonId: number; note?: string | null };
export type ReorderResult = Schemas['ReorderResponse']['data'];

export const LOCALES = ['en', 'ar'] as const satisfies readonly Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// listings, search, categories, brands, unknown paths
export type ProductListing = Schemas['ProductListing'];
export type ListingFacet = Schemas['ListingFacet'];
export type ListingFacetValue = ListingFacet['values'][number];
export type ListingRange = NonNullable<ListingFacet['range']>;
export type ListingSortOption = ProductListing['sort'][number];
export type AppliedFilter = ProductListing['appliedFilters'][number];
export type SearchSuggestions = Schemas['SearchSuggestionsResponse']['data'];
export type CategoryNode = Schemas['CategoryNode'];
export type CategoryTree = Schemas['CategoriesResponse']['data'];
export type BrandsPage = Schemas['BrandsResponse']['data'];
export type Resolution = Schemas['Resolution'];

// orders extras: tracking without sign-in, order rating, product reviews
export type RateOrderInput = Schemas['RateOrderRequest'];
export type WriteReviewInput = Schemas['WriteReviewRequest'];
/** `Order.rating`: the rating the shopper gave (null = not rated). */
export type OrderRating = NonNullable<Order['rating']>;
/** `Order.ratingForm`: how to draw the rating dialog (null = cannot rate now). */
export type OrderRatingForm = NonNullable<Order['ratingForm']>;
/** `ProductReviewsPage.write`: whether and how the shopper may write a review. */
export type ReviewAccess = NonNullable<ProductReviewsPage['write']>;
export type MessageResult = Schemas['MessageResponse']['data'];
// auth and account: sign in / up / out, social, OTP, password reset, verification, profile, password
export type AuthSettings = Schemas['AuthSettings'];
export type FormField = Schemas['FormField'];
export type SocialProvider = Schemas['SocialSignInRequest']['provider'];
export type Customer = Schemas['Customer'];
export type Session = Schemas['Session'];
/** What the storefront must do next after a sign-in (`Session.next`) or on any page (`Me.next`). */
export type NextStep = NonNullable<Session['next']>;
export type SignInInput = Schemas['SignInRequest'];
export type SignUpValues = Schemas['SignUpRequest']['values'];
export type SocialSignInInput = Schemas['SocialSignInRequest'];
export type CompleteProfileInput = Schemas['CompleteProfileRequest'];
export type ForgotPasswordInput = Schemas['ForgotPasswordRequest'];
export type ForgotPasswordResult = Schemas['ForgotPasswordResponse']['data'];
export type ResetPasswordInput = Schemas['ResetPasswordRequest'];
export type CodeSent = Schemas['CodeSentResponse']['data'];
export type SignedOut = Schemas['SignedOutResponse']['data'];
export type Profile = Schemas['ProfileResponse']['data'];
export type ProfileField = Schemas['ProfileField'];
export type ProfileValues = Schemas['ProfileInput']['values'];
// seo + marketing: structured data, site facts, sitemap, pixel ids, server-side events
export type Breadcrumb = Schemas['Breadcrumb'];
export type StructuredData = Schemas['StructuredData'];
export type ProductStructuredData = NonNullable<StructuredData['product']>;
export type CollectionStructuredData = NonNullable<StructuredData['collection']>;
export type WebPageStructuredData = NonNullable<StructuredData['webPage']>;
export type SeoPagination = NonNullable<Seo['pagination']>;
export type OpenGraph = NonNullable<Seo['openGraph']>;
export type SiteSeo = Schemas['SiteSeo'];
export type PostalAddress = Schemas['PostalAddress'];
export type SitemapPage = Schemas['SitemapResponse']['data'];
export type SitemapEntry = SitemapPage['items'][number];
export type SitemapType = import('../generated/api').operations['getSitemap']['parameters']['query']['type'];
export type Marketing = Schemas['Marketing'];
export type EventRequest = Schemas['EventRequest'];
export type EventName = EventRequest['name'];
export type EventAccepted = Schemas['EventAcceptedResponse']['data'];
// ---- shell: content pages, forms, mobile nav, area (shell agent); FormField and MessageResult are above
export type ContentPage = Schemas['Page'];
export type PageContact = NonNullable<ContentPage['contact']>;
export type Branch = Schemas['Branch'];
export type BranchesPage = Schemas['BranchesResponse']['data'];
export type BranchGroup = BranchesPage['groups'][number];
export type LandingPage = Schemas['LandingPage'];
export type MerchantForm = Schemas['Form'];
export type FormValues = Schemas['FormSubmission']['values'];
export type MobileNavItem = Schemas['MobileNavItem'];
export type MobileNav = NonNullable<Layout['mobileNav']>;
export type LegalLinks = NonNullable<Layout['legal']>;
export type AppBanner = NonNullable<Layout['appBanner']>;
export type AreaSelection = NonNullable<Layout['areaSelection']>;
export type StoreStatus = NonNullable<Layout['storeStatus']>;
export type ShopperArea = NonNullable<Me['area']>;
