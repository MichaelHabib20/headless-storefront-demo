// Errors shared by every API.
export { ApiError, isApiError, type ApiErrorKind } from './errors';

// Storefront API v3 (contract: contract/openapi.yaml).
export { createStorefrontClient, type StorefrontClient, type StorefrontClientOptions } from './v3/http';
export { getHome, getLayout } from './v3/storefront';
export * from './v3/shopper';
export { getCheckoutSettings, getLocations } from './v3/settings';
export { getProduct, getProductRecommendations, getProductReviews, notifyWhenAvailable, writeReview } from './v3/product';
export { getBrands, getCategories, getProducts, getSearchSuggestions, getVendors, listingQuery, resolvePath, type ListingParams, type ListingScope } from './v3/catalog';
export * from './v3/checkout';
export * from './v3/account';
export * from './v3/auth';
export * from './v3/types';
// seo + marketing
export { getSiteSeo, getSitemap, trackEvent } from './v3/seo';
// shell: content pages, forms, the shopper's area
export { getBranches, getForm, getLandingPage, getPage, sendContactMessage, setArea, submitForm } from './v3/content';
// account extras: prescriptions
export { cancelPrescription, getPrescriptionCancellationReasons, getPrescriptionForm, getPrescriptions, sendPrescription } from './v3/prescriptions';
// account extras: loyalty (El Dokan, iVend)
export { getLoyalty, getLoyaltyHistory, getLoyaltyReferral, getLoyaltyReward, getLoyaltyRewards, redeemLoyaltyReward } from './v3/loyalty';
// phase B: wallet
export { getWallet } from './v3/wallet';
// phase B: insurance
export { addInsuranceProfile, deleteInsuranceProfile, getInsurance, updateInsuranceProfile } from './v3/insurance';
// phase B: vouchers
export { addVoucher, getVouchers } from './v3/vouchers';
