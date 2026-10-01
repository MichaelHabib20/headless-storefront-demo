'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import type { AuthSettings, Locale } from '@/sdk';
import { SocialButtons } from '@/components/auth/SocialButtons';
import type { FormState } from '@/lib/form';
import { sendOtpAction, signInAction, signInWithOtpAction, socialSignInAction, type OtpState } from './actions';

export interface SignInLabels {
  identifierPhone: string;
  identifierEmail: string;
  password: string;
  submit: string;
  submitting: string;
  forgot: string;
  tabPassword: string;
  tabOtp: string;
  otpSend: string;
  otpSending: string;
  otpCode: string;
  otpVerify: string;
  otpChangePhone: string;
  social: { or: string; google: string; facebook: string; apple: string; loading: string; failed: string };
}

interface SignInFormProps {
  settings: Pick<AuthSettings, 'loginMethod' | 'otpLogin' | 'social' | 'phone' | 'passwordReset'>;
  locale: Locale;
  next: string | null;
  forgotHref: string;
  labels: SignInLabels;
}

/**
 * The sign-in card: the identifier the store uses (`loginMethod`), the password, and — when the
 * store turned them on — the SMS-code tab (`otpLogin`) and the social buttons (`social`).
 */
export function SignInForm({ settings, locale, next, forgotHref, labels }: SignInFormProps) {
  const [tab, setTab] = useState<'password' | 'otp'>('password');
  const isPhone = settings.loginMethod === 'phone';

  return (
    <div>
      {settings.otpLogin && (
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'password'} onClick={() => setTab('password')}>
            {labels.tabPassword}
          </button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'otp'} onClick={() => setTab('otp')}>
            {labels.tabOtp}
          </button>
        </div>
      )}
      {tab === 'password' ? (
        <PasswordForm settings={settings} locale={locale} next={next} forgotHref={forgotHref} labels={labels} isPhone={isPhone} />
      ) : (
        <OtpForm settings={settings} locale={locale} next={next} labels={labels} />
      )}
      <SocialButtons social={settings.social} locale={locale} next={next} labels={labels.social} action={socialSignInAction} />
    </div>
  );
}

function PasswordForm({ settings, locale, next, forgotHref, labels, isPhone }: SignInFormProps & { isPhone: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signInAction, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} noValidate data-testid="sign-in-form">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}
      {state.message && (
        <div className="alert" role="alert">
          {state.message}
        </div>
      )}

      <label>
        {isPhone ? labels.identifierPhone : labels.identifierEmail}
        <input
          name="identifier"
          type={isPhone ? 'tel' : 'email'}
          autoComplete={isPhone ? 'tel' : 'email'}
          inputMode={isPhone ? 'numeric' : 'email'}
          maxLength={isPhone ? settings.phone.length ?? undefined : undefined}
          placeholder={isPhone ? settings.phone.example ?? undefined : undefined}
          defaultValue={state.values?.identifier}
          aria-invalid={Boolean(errors.identifier)}
          required
        />
        {errors.identifier && <span className="field-error">{errors.identifier}</span>}
      </label>

      <label>
        {labels.password}
        <input name="password" type="password" autoComplete="current-password" aria-invalid={Boolean(errors.password)} required />
        {errors.password && <span className="field-error">{errors.password}</span>}
      </label>

      <div className="links">
        {settings.passwordReset.method !== 'none' && <Link href={forgotHref}>{labels.forgot}</Link>}
      </div>

      <button type="submit" disabled={pending}>
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}

function OtpForm({ settings, locale, next, labels }: Omit<SignInFormProps, 'forgotHref'>) {
  const [sendState, sendAction, sending] = useActionState<OtpState, FormData>(sendOtpAction, {});
  const [verifyState, verifyAction, verifying] = useActionState<OtpState, FormData>(signInWithOtpAction, {});
  const [phoneAgain, setPhoneAgain] = useState(false);
  const sent = !phoneAgain && (verifyState.sent ?? sendState.sent);

  if (!sent) {
    const errors = sendState.fieldErrors ?? {};
    return (
      <form action={sendAction} noValidate data-testid="otp-send-form">
        <input type="hidden" name="locale" value={locale} />
        {sendState.message && (
          <div className="alert" role="alert">
            {sendState.message}
          </div>
        )}
        <label>
          {labels.identifierPhone}
          <input
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            maxLength={settings.phone.length ?? undefined}
            placeholder={settings.phone.example ?? undefined}
            defaultValue={sendState.values?.phone}
            aria-invalid={Boolean(errors.phone)}
            required
          />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <button type="submit" disabled={sending}>
          {sending ? labels.otpSending : labels.otpSend}
        </button>
      </form>
    );
  }

  const errors = verifyState.fieldErrors ?? {};
  return (
    <form action={verifyAction} noValidate data-testid="otp-verify-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phone" value={sent.phone} />
      {next && <input type="hidden" name="next" value={next} />}
      {sent.message && (
        <div className="success" role="status">
          {sent.message} {sent.destination}
        </div>
      )}
      {verifyState.message && (
        <div className="alert" role="alert">
          {verifyState.message}
        </div>
      )}
      <label>
        {labels.otpCode}
        <input name="code" inputMode="numeric" autoComplete="one-time-code" aria-invalid={Boolean(errors.code)} required />
        {errors.code && <span className="field-error">{errors.code}</span>}
      </label>
      <button type="submit" disabled={verifying}>
        {verifying ? labels.submitting : labels.otpVerify}
      </button>
      <button type="button" className="link-button" onClick={() => setPhoneAgain(true)}>
        {labels.otpChangePhone}
      </button>
    </form>
  );
}
