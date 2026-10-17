'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { callAction } from '@/lib/safe-action';
import type { AuthSettings, Locale, SocialProvider } from '@/sdk';

export interface SocialSignInResult {
  ok: boolean;
  message?: string;
}

interface SocialButtonsProps {
  social: AuthSettings['social'];
  locale: Locale;
  /** Where to go after the sign-in (a local page), or null. */
  next: string | null;
  labels: { or: string; google: string; facebook: string; apple: string; loading: string; failed: string };
  /** Server action: sends the provider's token to the backend (which verifies it) and redirects on success. */
  action: (locale: Locale, provider: SocialProvider, token: string, name: string | null, next: string | null) => Promise<SocialSignInResult>;
}

// Minimal shapes of the provider SDKs (loaded only when the store configured the provider).
interface GoogleIdentity {
  accounts: { id: { initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void; renderButton: (el: HTMLElement, options: Record<string, unknown>) => void } };
}
interface FacebookSdk {
  init: (config: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
  login: (callback: (response: { authResponse?: { accessToken?: string } }) => void, options: { scope: string }) => void;
}
interface AppleSdk {
  auth: {
    init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
    signIn: () => Promise<{ authorization: { id_token: string }; user?: { name?: { firstName?: string; lastName?: string } } }>;
  };
}
declare global {
  interface Window {
    google?: GoogleIdentity;
    FB?: FacebookSdk;
    AppleID?: AppleSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK = {
  google: 'https://accounts.google.com/gsi/client',
  facebook: 'https://connect.facebook.net/en_US/sdk.js',
  apple: 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
};

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === src);
    if (existing?.dataset.loaded === '1') return resolve();
    const script = existing ?? document.createElement('script');
    script.addEventListener('load', () => {
      script.dataset.loaded = '1';
      resolve();
    });
    script.addEventListener('error', () => reject(new Error(`could not load ${src}`)));
    if (!existing) {
      script.src = src;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

/**
 * "Continue with Google / Facebook / Apple": one button per provider the store configured
 * (`AuthSettings.social`), each with the provider's own browser SDK, loaded only then. The SDK gives
 * a token; the backend verifies it and signs the shopper in (the token is never stored here).
 */
export function SocialButtons({ social, locale, next, labels, action }: SocialButtonsProps) {
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ google: boolean; facebook: boolean; apple: boolean }>({ google: false, facebook: false, apple: false });
  const [pending, startTransition] = useTransition();
  const googleButton = useRef<HTMLDivElement>(null);
  const providers = (['google', 'facebook', 'apple'] as const).filter((name) => social[name]);

  const submit = (provider: SocialProvider, token: string, name: string | null) => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => action(locale, provider, token, name, next), { ok: false, message: labels.failed });
      if (!result.ok) setError(result.message ?? labels.failed);
    });
  };

  useEffect(() => {
    let cancelled = false;
    const google = social.google;
    if (google) {
      loadScript(SDK.google)
        .then(() => {
          if (cancelled || !window.google || !googleButton.current) return;
          window.google.accounts.id.initialize({ client_id: google.clientId, callback: (response) => submit('google', response.credential, null) });
          window.google.accounts.id.renderButton(googleButton.current, { theme: 'outline', size: 'large', width: 320, locale });
          setReady((state) => ({ ...state, google: true }));
        })
        .catch(() => setError(labels.failed));
    }
    const facebook = social.facebook;
    if (facebook) {
      window.fbAsyncInit = () => window.FB?.init({ appId: facebook.appId, cookie: false, xfbml: false, version: 'v19.0' });
      loadScript(SDK.facebook)
        .then(() => !cancelled && setReady((state) => ({ ...state, facebook: true })))
        .catch(() => setError(labels.failed));
    }
    const apple = social.apple;
    if (apple) {
      loadScript(SDK.apple)
        .then(() => {
          if (cancelled) return;
          window.AppleID?.auth.init({ clientId: apple.clientId, scope: 'name email', redirectURI: window.location.origin + window.location.pathname, usePopup: true });
          setReady((state) => ({ ...state, apple: true }));
        })
        .catch(() => setError(labels.failed));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the SDKs are loaded once for the configured providers
  }, [social.google?.clientId, social.facebook?.appId, social.apple?.clientId, locale]);

  if (providers.length === 0) return null;

  const facebookLogin = () =>
    window.FB?.login((response) => {
      const token = response.authResponse?.accessToken;
      if (token) submit('facebook', token, null);
      else setError(labels.failed);
    }, { scope: 'email,public_profile' });

  const appleLogin = async () => {
    try {
      const response = await window.AppleID!.auth.signIn();
      const name = response.user?.name ? [response.user.name.firstName, response.user.name.lastName].filter(Boolean).join(' ') : null;
      submit('apple', response.authorization.id_token, name || null);
    } catch {
      setError(labels.failed);
    }
  };

  return (
    <div className="social" data-testid="social-sign-in">
      <p className="social-or">{labels.or}</p>
      {social.google && (
        <div data-testid="social-google" aria-label={labels.google}>
          <div ref={googleButton} />
          {!ready.google && <span className="hint">{labels.loading}</span>}
        </div>
      )}
      {social.facebook && (
        <button type="button" className="social-button" data-testid="social-facebook" disabled={!ready.facebook || pending} onClick={facebookLogin}>
          {labels.facebook}
        </button>
      )}
      {social.apple && (
        <button type="button" className="social-button" data-testid="social-apple" disabled={!ready.apple || pending} onClick={appleLogin}>
          {labels.apple}
        </button>
      )}
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
