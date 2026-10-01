/**
 * Sign in / up / out, social and OTP sign-in, password reset, phone and e-mail verification
 * (contract: contract/openapi.yaml `/auth/*`). Pages call these, never HTTP.
 *
 * `GuestContext.token` on the sign-in calls is the GUEST token (if the visitor has one): the
 * backend merges the guest's cart, wishlist and compare list into the customer. The answer's
 * `Session.token` is the customer's token from then on; `Session.next` says what the storefront
 * must do next (verify the phone, wait for approval, complete a social profile).
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type {
  AuthSettings,
  CodeSent,
  CompleteProfileInput,
  Customer,
  ForgotPasswordInput,
  ForgotPasswordResult,
  Locale,
  MessageResult,
  ResetPasswordInput,
  Session,
  SignInInput,
  SignUpValues,
  SignedOut,
  SocialSignInInput,
} from './types';

/** The visitor's guest token, if any, to be merged on sign-in (null: nothing to merge). */
export interface GuestContext {
  locale: Locale;
  token?: string | null;
}

/** What the sign-in / sign-up pages show, decided by the store (public). */
export const getAuthSettings = (client: StorefrontClient, locale: Locale) => client.get<AuthSettings>('auth/settings', locale);

/** Password sign-in. `identifier` is the e-mail or the phone, as `AuthSettings.loginMethod` says. */
export const signIn = (client: StorefrontClient, ctx: GuestContext, input: SignInInput) =>
  client.request<Session>('POST', 'auth/sign-in', { ...ctx, body: input });

/** Creates the account from the values of `AuthSettings.signup.fields` (keyed by `name`) and signs in. */
export const signUp = (client: StorefrontClient, ctx: GuestContext, values: SignUpValues) =>
  client.request<Session>('POST', 'auth/sign-up', { ...ctx, body: { values } });

/** Revokes the customer's token: a later call with it answers 401. */
export const signOut = (client: StorefrontClient, ctx: ShopperContext) => client.request<SignedOut>('POST', 'auth/sign-out', ctx);

/** Google / Facebook / Apple: the provider's token is verified by the backend. */
export const signInWithProvider = (client: StorefrontClient, ctx: GuestContext, input: SocialSignInInput) =>
  client.request<Session>('POST', 'auth/social', { ...ctx, body: input });

/** After `next = complete_profile`: the name and phone the provider did not give. Needs the customer token. */
export const completeSocialProfile = (client: StorefrontClient, ctx: ShopperContext, input: CompleteProfileInput) =>
  client.request<Session>('POST', 'auth/social/complete', { ...ctx, body: input });

/** Only when `AuthSettings.otpLogin`. */
export const sendOtp = (client: StorefrontClient, locale: Locale, phone: string) =>
  client.request<CodeSent>('POST', 'auth/otp/send', { locale, body: { phone } });

export const signInWithOtp = (client: StorefrontClient, ctx: GuestContext, input: { phone: string; code: string }) =>
  client.request<Session>('POST', 'auth/otp/verify', { ...ctx, body: input });

/** Starts a reset: the answer's `method` says what the shopper receives (a code by SMS or a link by e-mail). */
export const forgotPassword = (client: StorefrontClient, locale: Locale, input: ForgotPasswordInput) =>
  client.request<ForgotPasswordResult>('POST', 'auth/password/forgot', { locale, body: input });

/** `{phone, code, password}` (SMS) or `{token, password}` (e-mail); signs the shopper in. */
export const resetPassword = (client: StorefrontClient, ctx: GuestContext, input: ResetPasswordInput) =>
  client.request<Session>('POST', 'auth/password/reset', { ...ctx, body: input });

/** Sends (again) the code that verifies the signed-in customer's phone. */
export const sendPhoneCode = (client: StorefrontClient, ctx: ShopperContext) => client.request<CodeSent>('POST', 'auth/phone/send-code', ctx);

export const verifyPhone = (client: StorefrontClient, ctx: ShopperContext, code: string) =>
  client.request<Customer>('POST', 'auth/phone/verify', { ...ctx, body: { code } });

/** Confirms a changed e-mail with the `email` + `token` from the mail's link (public). */
export const verifyEmail = (client: StorefrontClient, locale: Locale, input: { email: string; token: string }) =>
  client.request<MessageResult>('POST', 'auth/email/verify', { locale, body: input });
