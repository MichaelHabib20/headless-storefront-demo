import type { Client } from './client';
import { messageFor, unexpected } from './client';
import { ApiError, isApiError, renameFields, type ApiErrorKind } from './errors';

export interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
}

export interface Session {
  token: string;
  customer: Customer;
}

export type LoginInput =
  | { method: 'email'; email: string; password: string }
  | { method: 'phone'; phone: string; password: string };

export interface SignupInput {
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  email?: string;
  /** YYYY-MM-DD */
  birthdate?: string;
  referralCode?: string;
}

/** Backend field name -> SDK field name, for validation errors. */
const SIGNUP_FIELDS: Record<string, string> = {
  name: 'firstName',
  last_name: 'lastName',
  refered: 'referralCode',
};

interface RawCustomer {
  id: number;
  token?: string;
  name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_verified?: number | boolean | null;
}

function toSession(raw: RawCustomer): Session {
  if (!raw.token) throw new ApiError('server', 200, 'Signed in, but the store did not return a session.');
  return {
    token: raw.token,
    customer: {
      id: raw.id,
      firstName: raw.name ?? '',
      lastName: raw.last_name ?? '',
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      phoneVerified: Boolean(Number(raw.phone_verified ?? 0)),
    },
  };
}

/** Login failures all come back as code 403; `errors.errorMessage` tells them apart. */
function loginFailureKind(errorMessage: string | undefined): ApiErrorKind {
  switch (errorMessage?.toLowerCase()) {
    case 'invalid data':
      return 'invalid_credentials';
    case 'account deactivated':
      return 'account_deactivated';
    case 'account has social':
      return 'social_account_only';
    default:
      return 'not_allowed';
  }
}

/**
 * Signs in with a password. The method must match `AuthConfig.loginMethod`;
 * the backend decides which one the store uses.
 */
export async function login(client: Client, input: LoginInput): Promise<Session> {
  const body = input.method === 'email'
    ? { email: input.email, password: input.password }
    : { phone: input.phone, password: input.password };

  const env = await client.request<RawCustomer>('POST', 'auth', body);
  if (env.code === 200 && env.data) return toSession(env.data);
  if (env.code === 403) {
    const kind = loginFailureKind(env.errors?.errorMessage);
    throw new ApiError(kind, 403, messageFor(env, client.locale, kind));
  }
  throw unexpected(env, client.locale);
}

/** Creates an account. On success the customer is signed in (phone may still be unverified). */
export async function signup(client: Client, input: SignupInput): Promise<Session> {
  const body = {
    name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
    password: input.password,
    email: input.email || undefined,
    birthdate: input.birthdate || undefined,
    refered: input.referralCode || undefined,
  };

  try {
    const env = await client.request<RawCustomer>('POST', 'auth/signup', body);
    if (env.code === 200 && env.data) return toSession(env.data);
    if (env.code === 401) {
      throw new ApiError('signup_disabled', 401, messageFor(env, client.locale, 'signup_disabled'));
    }
    if (env.code === 422) {
      const message = messageFor(env, client.locale, 'phone_taken');
      throw new ApiError('phone_taken', 422, message, { phone: [message] });
    }
    throw unexpected(env, client.locale);
  } catch (error) {
    throw isApiError(error) ? renameFields(error, SIGNUP_FIELDS) : error;
  }
}
