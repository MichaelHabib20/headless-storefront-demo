import type { Client } from './client';
import { unexpected } from './client';

/** What the auth pages need to know, already decided from the store's configuration. */
export interface AuthConfig {
  /** How customers identify themselves when signing in and signing up. */
  loginMethod: 'email' | 'phone';
  signupEnabled: boolean;
  otpLoginEnabled: boolean;
  /** Whether the sign-up form shows the email field, and whether the backend requires it. */
  signupEmail: 'required' | 'optional' | 'hidden';
  showBirthdate: boolean;
  showReferralCode: boolean;
  phone: { prefix?: string; length?: number; pattern?: string; countryCode?: string };
  /**
   * Sign-up requirements this SDK version does not support yet
   * (the backend will reject sign-up while they are on).
   */
  unsupported: Array<'customer_group' | 'international_country'>;
}

type RawConfig = Record<string, unknown>;

/** Config values arrive as raw strings from the database ("1", "0", "true", ...). */
function flag(raw: RawConfig, key: string, fallback = false): boolean {
  const value = raw[key];
  if (value === undefined || value === null || value === '') return fallback;
  return value === true || value === 1 || value === '1' || value === 'true';
}

function text(raw: RawConfig, key: string): string | undefined {
  const value = raw[key];
  return value === undefined || value === null || value === '' ? undefined : String(value);
}

export async function getRawConfig(client: Client): Promise<RawConfig> {
  const env = await client.request<RawConfig>('GET', 'configurations');
  if (env.code !== 200 || !env.data) throw unexpected(env, client.locale);
  return env.data;
}

export function toAuthConfig(raw: RawConfig): AuthConfig {
  const loginMethod = flag(raw, 'enablePhoneLogin') ? 'phone' : 'email';

  // Backend rule (RegisterRequest): email is always required in email mode;
  // in phone mode it is required only when SIGNUP_EMAIL_CONFIG is 'show-required'.
  let signupEmail: AuthConfig['signupEmail'] = 'required';
  if (loginMethod === 'phone') {
    const setting = text(raw, 'SIGNUP_EMAIL_CONFIG');
    signupEmail = setting === 'show-required' ? 'required' : setting === 'hide' ? 'hidden' : 'optional';
  }

  const localization = (raw.localization ?? {}) as Record<string, unknown>;
  const length = Number(localization.phone_length);

  const unsupported: AuthConfig['unsupported'] = [];
  if (flag(raw, 'ENABLE_INVENTORY_CUSTOMER_GROUPS') || flag(raw, 'ENABLE_CUSTOMER_GROUPS')) unsupported.push('customer_group');
  if (flag(raw, 'ENABLE_INTERNATIONAL_ADDRESS')) unsupported.push('international_country');

  return {
    loginMethod,
    signupEnabled: flag(raw, 'ENABLE_SIGN_UP', true),
    otpLoginEnabled: flag(raw, 'enableOtpLogin'),
    signupEmail,
    showBirthdate: flag(raw, 'ENABLE_SHOW_BIRTH_DATE'),
    showReferralCode: text(raw, 'USE_REFERRED_AS') === 'signup' && !flag(raw, 'DISABLE_REFERRAL_CODE'),
    phone: {
      prefix: localization.phone_prefix ? String(localization.phone_prefix) : undefined,
      length: Number.isFinite(length) && length > 0 ? length : undefined,
      pattern: localization.phone_pattern ? String(localization.phone_pattern) : undefined,
      countryCode: localization.country_code ? String(localization.country_code) : undefined,
    },
    unsupported,
  };
}

export async function getAuthConfig(client: Client): Promise<AuthConfig> {
  return toAuthConfig(await getRawConfig(client));
}
