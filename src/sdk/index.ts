// Legacy customer API (auth). Kept until auth moves to v3.
export { createClient, type Client, type ClientOptions } from './client';
export { getAuthConfig, getRawConfig, toAuthConfig, type AuthConfig } from './config';
export { login, signup, type Customer, type LoginInput, type Session, type SignupInput } from './auth';

// Errors shared by every API.
export { ApiError, isApiError, type ApiErrorKind } from './errors';

// Storefront API v3 (contract: contract/openapi.yaml).
export { createStorefrontClient, type StorefrontClient, type StorefrontClientOptions } from './v3/http';
export { getHome, getLayout } from './v3/storefront';
export * from './v3/types';
