// Legacy customer API (auth). Kept until auth moves to v3.
export { createClient, type Client, type ClientOptions } from './client';
export { getAuthConfig, getRawConfig, toAuthConfig, type AuthConfig } from './config';
export { login, signup, type Customer, type LoginInput, type Session, type SignupInput } from './auth';

// Errors shared by every API.
export { ApiError, isApiError, type ApiErrorKind } from './errors';

// Storefront API v3 (contract: contract/openapi.yaml).
export { createStorefrontClient, type StorefrontClient, type StorefrontClientOptions } from './v3/http';
export { getHome, getLayout } from './v3/storefront';
export * from './v3/shopper';
export { getCheckoutSettings, getLocations } from './v3/settings';
export { getProduct, getProductRecommendations, getProductReviews, notifyWhenAvailable } from './v3/product';
export { getBrands, getCategories, getProducts, getSearchSuggestions, listingQuery, resolvePath, type ListingParams, type ListingScope } from './v3/catalog';
export * from './v3/checkout';
export * from './v3/account';
export * from './v3/types';
// shell: content pages, forms, the shopper's area
export { getBranches, getForm, getLandingPage, getPage, sendContactMessage, setArea, submitForm } from './v3/content';
