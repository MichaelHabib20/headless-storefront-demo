/**
 * Mock module: sign in / up / out, social, OTP, password reset, phone and e-mail verification,
 * profile and password (contract `/auth/*`, `/account/profile`, `/account/password`).
 *
 *   GET  /auth/settings           → AuthSettingsResponse (toggled with POST /__mode {"auth": {...}})
 *   POST /auth/sign-in            → SessionResponse | 401 invalid_credentials | 403 account_deactivated
 *   POST /auth/sign-up            → 201 SessionResponse | 422 validation_failed (fields by v3 name) | 409 phone_in_use | 403 signup_disabled
 *   POST /auth/sign-out           → SignedOutResponse; the token answers 401 afterwards (every path)
 *   POST /auth/social             → SessionResponse (token "google-ok" / "facebook-ok" / "apple-ok"; next complete_profile) | 502 provider_error | 404 when not configured
 *   POST /auth/social/complete    → SessionResponse
 *   POST /auth/otp/send | verify  → CodeSentResponse | SessionResponse (code 1234) | 404 when otpLogin is off
 *   POST /auth/password/forgot    → ForgotPasswordResponse (sms: code 1234; email: token "reset-token-ok")
 *   POST /auth/password/reset     → SessionResponse | 422 invalid_code / code_expired
 *   POST /auth/phone/send-code | verify → CodeSentResponse | CustomerResponse (code 1234) | 409 phone_already_verified
 *   POST /auth/email/verify       → MessageResponse (token "email-token-ok" for the pending address)
 *   GET/PUT /account/profile, PUT /account/password → ProfileResponse | MessageResponse; guests get 401
 *
 * Seeded customers: "test-customer" (phone 01222353123 / secret123, verified, id 4550965, shares the
 * shopper store's seeded cart and lists) and the second customer (01000000002 / secret123, phone not
 * verified, not approved when approval is on). Every code is 1234. A guest bearer on sign-in / sign-up
 * is merged into the customer (cart quantities, wishlist, compare). Test scaffolding only: the real
 * rules live in the backend.
 */

const TEXT = {
  en: {
    labels: { firstName: 'First name', lastName: 'Last name', phone: 'Phone number', email: 'Email', password: 'Password', birthdate: 'Date of birth', referralCode: 'Referral code', customerGroup: 'Customer group', country: 'Country' },
    passwordHint: 'At least 8 characters',
    phoneHint: '11 digits',
    waiting: 'Your account is being reviewed. We will let you know as soon as it is approved.',
    required: (label) => `${label} is required.`,
    phoneFormat: 'Enter a mobile number of 11 digits.',
    passwordShort: 'The password must be at least 8 characters.',
    emailFormat: 'Enter a valid e-mail address.',
    codeSent: 'We sent a verification code to your phone.',
    resetCodeSent: 'We sent a code to reset your password.',
    resetLinkSent: 'If an account exists for this address, a reset link is on its way.',
    emailVerified: 'Your e-mail address was confirmed.',
    passwordChanged: 'Your password was changed.',
    errors: {
      unauthenticated: 'Please start a session first.',
      not_found: 'Not found.',
      validation_failed: 'Please check the highlighted fields.',
      invalid_credentials: 'The details you entered are not correct.',
      account_deactivated: 'This account has been deactivated. Please contact us.',
      signup_disabled: 'This store does not accept new accounts at the moment.',
      phone_in_use: 'This phone number belongs to another account. Please sign in or use another number.',
      email_in_use: 'This e-mail address belongs to another account.',
      provider_error: 'We could not confirm your account with the provider. Please try again.',
      invalid_code: 'The code is not correct.',
      code_expired: 'This code has expired. Please request a new one.',
      phone_already_verified: 'Your phone number is already verified.',
      wrong_password: 'The current password is not correct.',
    },
  },
  ar: {
    labels: { firstName: 'الاسم الأول', lastName: 'اسم العائلة', phone: 'رقم الهاتف', email: 'البريد الإلكتروني', password: 'كلمة المرور', birthdate: 'تاريخ الميلاد', referralCode: 'كود الإحالة', customerGroup: 'مجموعة العملاء', country: 'الدولة' },
    passwordHint: '8 أحرف على الأقل',
    phoneHint: '11 أرقام',
    waiting: 'حسابك قيد المراجعة. سنخبرك فور الموافقة عليه.',
    required: (label) => `${label} مطلوب.`,
    phoneFormat: 'أدخل رقم موبايل من 11 رقماً.',
    passwordShort: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.',
    emailFormat: 'أدخل بريداً إلكترونياً صحيحاً.',
    codeSent: 'أرسلنا رمز التحقق إلى هاتفك.',
    resetCodeSent: 'أرسلنا رمزاً لإعادة تعيين كلمة المرور.',
    resetLinkSent: 'إذا كان هناك حساب بهذا البريد، فرابط إعادة التعيين في طريقه إليك.',
    emailVerified: 'تم تأكيد بريدك الإلكتروني.',
    passwordChanged: 'تم تغيير كلمة المرور.',
    errors: {
      unauthenticated: 'يرجى بدء جلسة أولاً.',
      not_found: 'غير موجود.',
      validation_failed: 'يرجى مراجعة الحقول المحددة.',
      invalid_credentials: 'البيانات التي أدخلتها غير صحيحة.',
      account_deactivated: 'تم إيقاف هذا الحساب. يرجى التواصل معنا.',
      signup_disabled: 'هذا المتجر لا يقبل حسابات جديدة حالياً.',
      phone_in_use: 'رقم الهاتف هذا مسجل بحساب آخر. يرجى تسجيل الدخول أو استخدام رقم آخر.',
      email_in_use: 'هذا البريد الإلكتروني مسجل بحساب آخر.',
      provider_error: 'تعذر تأكيد حسابك لدى مزود الخدمة. يرجى المحاولة مرة أخرى.',
      invalid_code: 'الرمز غير صحيح.',
      code_expired: 'انتهت صلاحية هذا الرمز. يرجى طلب رمز جديد.',
      phone_already_verified: 'رقم هاتفك موثّق بالفعل.',
      wrong_password: 'كلمة المرور الحالية غير صحيحة.',
    },
  },
};

export const CODE = '1234';
export const RESET_TOKEN = 'reset-token-ok';
export const EMAIL_TOKEN = 'email-token-ok';
export const SOCIAL_TOKENS = { google: 'google-ok', facebook: 'facebook-ok', apple: 'apple-ok' };

/** The store flags the mock starts with (staging-like: phone login, sign-up on, e-mail optional, birthdate on). */
const DEFAULT_MODE = {
  loginMethod: 'phone',
  signupEnabled: true,
  emailField: 'optional', // required | optional | hidden
  birthdate: true,
  referral: false,
  customerGroups: false,
  otpLogin: false,
  passwordReset: 'sms', // sms | email | none
  social: { google: null, facebook: null, apple: null },
  verifyPhoneAfterSignup: false,
  approval: false,
};

const SEED = [
  { id: 4550965, firstName: 'Test', lastName: 'Customer', email: 'test@example.com', phone: '01222353123', password: 'secret123', phoneVerified: true, birthdate: '1990-05-04', approved: true, token: 'test-customer' },
  { id: 4551037, firstName: 'Second', lastName: 'Shopper', email: 'second@example.com', phone: '01000000002', password: 'secret123', phoneVerified: false, birthdate: null, approved: false, token: null },
];

const field = (name, label, kind, required, extra = {}) => ({ name, label, kind, required, placeholder: null, options: [], multiple: false, hint: null, maxLength: null, ...extra });
const maskPhone = (phone) => (phone && phone.length > 5 ? phone.slice(0, 2) + '•'.repeat(phone.length - 5) + phone.slice(-3) : phone ? '•'.repeat(phone.length) : null);
const maskEmail = (email) => (email && email.includes('@') ? email[0] + '•••' + email.slice(email.indexOf('@')) : null);
const isEmail = (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
const isPhone = (value) => /^01[0-9]{9}$/.test(value);

export function createAuthModule(store) {
  let mode;
  let customers;
  let tokens; // token → customer
  let revoked;
  let counter;
  let pendingEmails; // customerId → email

  function reset() {
    mode = structuredClone(DEFAULT_MODE);
    customers = SEED.map((row) => ({ ...row, state: null }));
    tokens = new Map();
    revoked = new Set();
    counter = 0;
    pendingEmails = new Map();
    // the seeded shopper session is the first customer's state
    const first = customers[0];
    first.state = store.session('test-customer');
    tokens.set('test-customer', first);
    syncState(first);
  }

  /** `POST /__mode {"auth": {...}}`: any DEFAULT_MODE key (e.g. {"otpLogin": true, "social": {"google": {"clientId": "g"}}}). */
  function setMode(auth) {
    if (!auth || typeof auth !== 'object') return;
    for (const [key, value] of Object.entries(auth)) {
      if (key === 'social') mode.social = { ...mode.social, ...value };
      else if (key in DEFAULT_MODE) mode[key] = value;
    }
    for (const customer of customers) syncState(customer);
  }

  const approval = (customer) => (mode.approval ? { status: customer.approved ? 'approved' : customer.approvalNotes ? 'rejected' : 'pending', notes: customer.approvalNotes ?? null } : null);
  const next = (customer) => (!customer.phone ? 'complete_profile' : mode.verifyPhoneAfterSignup && !customer.phoneVerified ? 'verify_phone' : mode.approval && !customer.approved ? 'waiting_approval' : null);

  function presentCustomer(customer) {
    return {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName ?? '',
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      phoneVerified: Boolean(customer.phoneVerified),
      birthdate: customer.birthdate ?? null,
      image: null,
      approval: approval(customer),
      referralCode: mode.referral ? `REF-${customer.id}` : null,
    };
  }

  /** What GET /me shows (shopper store): first name, the extras and the next step. */
  function syncState(customer) {
    if (!customer.state) return;
    customer.state.firstName = customer.firstName;
    customer.state.customerExtra = { lastName: customer.lastName ?? '', phoneVerified: Boolean(customer.phoneVerified), approval: approval(customer)?.status ?? null };
    customer.state.next = next(customer);
  }

  function session(customer, token = null) {
    if (!customer.state) customer.state = store.newCustomerState(customer.firstName);
    const issued = token ?? `customer-${customer.id}-${++counter}`;
    store.attach(issued, customer.state);
    tokens.set(issued, customer);
    syncState(customer);
    return { token: issued, customer: presentCustomer(customer), next: next(customer) };
  }

  /** The guest's cart quantities, wishlist and compare list move to the customer (legacy GuestLogin listener). */
  function merge(guestToken, customer) {
    const guest = guestToken ? store.session(guestToken) : null;
    if (!guest || !guest.isGuest || !customer.state || guest === customer.state) return;
    for (const [id, quantity] of guest.cart) customer.state.cart.set(id, quantity);
    for (const id of guest.wishlist) if (!customer.state.wishlist.includes(id)) customer.state.wishlist.push(id);
    for (const id of guest.compare) if (!customer.state.compare.includes(id)) customer.state.compare.push(id);
  }

  function signupFields(locale) {
    const t = TEXT[locale];
    const fields = [field('firstName', t.labels.firstName, 'text', true), field('lastName', t.labels.lastName, 'text', true)];
    const phone = field('phone', t.labels.phone, 'phone', true, { hint: t.phoneHint, maxLength: 11, placeholder: '01xxxxxxxxx' });
    const email = mode.loginMethod === 'email' ? field('email', t.labels.email, 'email', true) : mode.emailField === 'hidden' ? null : field('email', t.labels.email, 'email', mode.emailField === 'required');
    if (mode.loginMethod === 'phone') fields.push(phone, ...(email ? [email] : []));
    else fields.push(email, phone);
    fields.push(field('password', t.labels.password, 'password', true, { hint: t.passwordHint }));
    if (mode.birthdate) fields.push(field('birthdate', t.labels.birthdate, 'date', false));
    if (mode.referral) fields.push(field('referralCode', t.labels.referralCode, 'text', false));
    if (mode.customerGroups) fields.push(field('customerGroup', t.labels.customerGroup, 'select', true, { options: [{ value: '3', label: locale === 'ar' ? 'صيدليات' : 'Pharmacies', selected: false }, { value: '4', label: locale === 'ar' ? 'عيادات' : 'Clinics', selected: false }] }));
    return fields;
  }

  function settings(locale) {
    return {
      loginMethod: mode.loginMethod,
      signup: { enabled: mode.signupEnabled, fields: mode.signupEnabled ? signupFields(locale) : [] },
      otpLogin: mode.otpLogin,
      passwordReset: { method: mode.passwordReset },
      social: { google: mode.social.google ?? null, facebook: mode.social.facebook ?? null, apple: mode.social.apple ?? null },
      phone: { prefix: '+20', length: 11, example: '01xxxxxxxxx' },
      verifyPhoneAfterSignup: mode.verifyPhoneAfterSignup,
      approval: { required: mode.approval, waitingText: mode.approval ? TEXT[locale].waiting : null },
    };
  }

  function profileFields(customer, locale) {
    const t = TEXT[locale];
    const phoneLogin = mode.loginMethod === 'phone';
    const fields = [
      { ...field('firstName', t.labels.firstName, 'text', true), value: customer.firstName, editable: true },
      { ...field('lastName', t.labels.lastName, 'text', true), value: customer.lastName ?? '', editable: true },
      { ...field('phone', t.labels.phone, 'phone', true, { hint: t.phoneHint, maxLength: 11 }), value: customer.phone ?? null, editable: !phoneLogin },
    ];
    if (!phoneLogin) fields.push({ ...field('email', t.labels.email, 'email', true), value: customer.email ?? null, editable: false });
    else if (mode.emailField !== 'hidden') fields.push({ ...field('email', t.labels.email, 'email', mode.emailField === 'required'), value: customer.email ?? null, editable: true });
    if (mode.birthdate) fields.push({ ...field('birthdate', t.labels.birthdate, 'date', false), value: customer.birthdate ?? null, editable: true });
    return fields;
  }

  const profile = (customer, locale, nextStep = null) => ({ customer: presentCustomer(customer), fields: profileFields(customer, locale), next: nextStep });
  const codeSent = (locale, phone) => ({ message: TEXT[locale].codeSent, destination: maskPhone(phone), expiresInSeconds: 1800, codeLength: 4 });
  const byPhone = (phone) => customers.find((c) => c.phone === phone) ?? null;
  const byEmail = (email) => customers.find((c) => c.email === email) ?? null;

  function handle({ method, pathname, token, locale, body }) {
    const t = TEXT[locale];
    const error = (status, code, extra = {}) => [status, { error: { code, message: t.errors[code] ?? code, ...extra } }];
    const values = body && typeof body === 'object' ? body : {};

    // a revoked token is refused on every v3 path (the backend's V3JwtRevoked middleware)
    if (token && revoked.has(token)) return error(401, 'unauthenticated');
    if (!pathname.startsWith('/auth/') && !pathname.startsWith('/account/profile') && pathname !== '/account/password') return null;

    if (method === 'GET' && pathname === '/auth/settings') return [200, { data: settings(locale) }];

    if (method === 'POST' && pathname === '/auth/sign-in') {
      const identifier = String(values.identifier ?? '').trim();
      const password = String(values.password ?? '');
      const fields = {};
      if (!identifier) fields.identifier = [t.required(mode.loginMethod === 'phone' ? t.labels.phone : t.labels.email)];
      if (!password) fields.password = [t.required(t.labels.password)];
      if (Object.keys(fields).length) return error(422, 'validation_failed', { fields });
      const customer = mode.loginMethod === 'phone' ? byPhone(identifier) : byEmail(identifier);
      if (!customer || customer.password !== password) return error(401, 'invalid_credentials');
      if (customer.deactivated) return error(403, 'account_deactivated');
      const result = session(customer);
      merge(token, customer);
      return [200, { data: result }];
    }

    if (method === 'POST' && pathname === '/auth/sign-up') {
      if (!mode.signupEnabled) return error(403, 'signup_disabled');
      const input = values.values && typeof values.values === 'object' ? values.values : {};
      const fields = {};
      const form = signupFields(locale);
      const get = (name) => String(input[name] ?? '').trim();
      for (const f of form) if (f.required && !(f.name === 'password' ? String(input.password ?? '') : get(f.name))) fields[f.name] = [t.required(f.label)];
      if (get('phone') && !isPhone(get('phone'))) fields.phone = [t.phoneFormat];
      if (String(input.password ?? '').length > 0 && String(input.password).length < 8) fields.password = [t.passwordShort];
      if (get('email') && !isEmail(get('email'))) fields.email = [t.emailFormat];
      if (Object.keys(fields).length) return error(422, 'validation_failed', { fields });
      const existing = byPhone(get('phone'));
      if (existing && existing.phoneVerified) return error(409, 'phone_in_use');
      if (existing) existing.phone = null;
      if (get('email') && byEmail(get('email'))) return error(422, 'validation_failed', { fields: { email: [t.errors.email_in_use] } });
      const customer = {
        id: 4560000 + customers.length,
        firstName: get('firstName'),
        lastName: get('lastName'),
        email: get('email') || null,
        phone: get('phone'),
        password: String(input.password),
        phoneVerified: false,
        birthdate: form.some((f) => f.name === 'birthdate') ? get('birthdate') || null : null,
        approved: false,
        token: null,
        state: null,
      };
      customers.push(customer);
      // a guest signing up becomes the customer: its cart and lists are kept
      const guest = token ? store.session(token) : null;
      if (guest && guest.isGuest) {
        guest.isGuest = false;
        customer.state = guest;
        store.detach(token);
      }
      return [201, { data: session(customer) }];
    }

    if (method === 'POST' && pathname === '/auth/sign-out') {
      const state = token ? store.session(token) : null;
      if (!state) return error(401, 'unauthenticated');
      if (!state.isGuest) revoked.add(token);
      return [200, { data: { signedOut: true } }];
    }

    if (method === 'POST' && pathname === '/auth/social') {
      const provider = String(values.provider ?? '');
      if (!['google', 'facebook', 'apple'].includes(provider)) return error(422, 'validation_failed', { fields: { provider: ['Choose google, facebook or apple.'] } });
      if (!mode.social[provider]) return error(404, 'not_found');
      if (!mode.signupEnabled) return error(403, 'signup_disabled');
      if (values.token !== SOCIAL_TOKENS[provider]) return error(502, 'provider_error');
      let customer = customers.find((c) => c.provider === provider);
      if (!customer) {
        customer = { id: 4559000 + customers.length, provider, firstName: provider === 'apple' ? String(values.name ?? '').split(' ')[0] || '' : 'Sara', lastName: provider === 'apple' ? String(values.name ?? '').split(' ').slice(1).join(' ') : 'Social', email: `sara.${provider}@example.com`, phone: null, password: null, phoneVerified: true, birthdate: null, approved: true, token: null, state: null };
        customers.push(customer);
      }
      const result = session(customer);
      merge(token, customer);
      return [200, { data: result }];
    }

    if (method === 'POST' && pathname === '/auth/otp/send') {
      if (!mode.otpLogin) return error(404, 'not_found');
      const customer = byPhone(String(values.phone ?? '').trim());
      if (!customer) return error(404, 'not_found');
      return [200, { data: codeSent(locale, customer.phone) }];
    }
    if (method === 'POST' && pathname === '/auth/otp/verify') {
      if (!mode.otpLogin) return error(404, 'not_found');
      const customer = byPhone(String(values.phone ?? '').trim());
      if (!customer) return error(404, 'not_found');
      if (String(values.code ?? '') !== CODE) return error(422, 'invalid_code');
      customer.phoneVerified = true;
      const result = session(customer);
      merge(token, customer);
      return [200, { data: result }];
    }

    if (method === 'POST' && pathname === '/auth/password/forgot') {
      if (mode.passwordReset === 'none') return error(404, 'not_found');
      const identifier = String(values.identifier ?? '').trim();
      if (!identifier) return error(422, 'validation_failed', { fields: { identifier: [t.required(mode.passwordReset === 'sms' ? t.labels.phone : t.labels.email)] } });
      if (mode.passwordReset === 'email' && values.resetUrl && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(String(values.resetUrl))) {
        return error(422, 'validation_failed', { fields: { resetUrl: ["The reset page must be on the store's own site."] } });
      }
      return [200, { data: mode.passwordReset === 'sms' ? { method: 'sms', message: t.resetCodeSent, destination: maskPhone(identifier) } : { method: 'email', message: t.resetLinkSent, destination: maskEmail(identifier) } }];
    }
    if (method === 'POST' && pathname === '/auth/password/reset') {
      if (mode.passwordReset === 'none') return error(404, 'not_found');
      const password = String(values.password ?? '');
      if (password.length < 8) return error(422, 'validation_failed', { fields: { password: [t.passwordShort] } });
      let customer;
      if (mode.passwordReset === 'sms') {
        customer = byPhone(String(values.phone ?? '').trim());
        if (!customer || String(values.code ?? '') !== CODE) return error(422, 'invalid_code');
      } else {
        if (String(values.token ?? '') !== RESET_TOKEN) return error(422, 'code_expired');
        customer = customers[0];
      }
      customer.password = password;
      for (const [issued, owner] of tokens) if (owner === customer && issued !== 'test-customer') revoked.add(issued);
      const result = session(customer);
      merge(token, customer);
      return [200, { data: result }];
    }

    if (method === 'POST' && pathname === '/auth/email/verify') {
      const email = String(values.email ?? '').trim();
      const owner = [...pendingEmails.entries()].find(([, pending]) => pending === email)?.[0];
      if (!owner || String(values.token ?? '') !== EMAIL_TOKEN) return error(422, 'invalid_code');
      if (byEmail(email)) return error(409, 'email_in_use');
      const customer = customers.find((c) => c.id === owner);
      customer.email = email;
      pendingEmails.delete(owner);
      return [200, { data: { message: t.emailVerified } }];
    }

    // from here on: the signed-in customer (a guest token is a session, not a customer)
    const customer = token ? tokens.get(token) : null;
    if (!customer) return error(401, 'unauthenticated');

    if (method === 'POST' && pathname === '/auth/social/complete') {
      const fields = {};
      for (const name of ['firstName', 'lastName', 'phone']) if (!String(values[name] ?? '').trim()) fields[name] = [t.required(t.labels[name])];
      if (values.phone && !isPhone(String(values.phone).trim())) fields.phone = [t.phoneFormat];
      if (Object.keys(fields).length) return error(422, 'validation_failed', { fields });
      const other = byPhone(String(values.phone).trim());
      if (other && other !== customer && other.phoneVerified) return error(409, 'phone_in_use');
      customer.firstName = String(values.firstName).trim();
      customer.lastName = String(values.lastName).trim();
      customer.phoneVerified = customer.phone === String(values.phone).trim() ? customer.phoneVerified : false;
      customer.phone = String(values.phone).trim();
      if (values.email) customer.email = String(values.email).trim();
      return [200, { data: session(customer, token) }];
    }
    if (method === 'POST' && pathname === '/auth/phone/send-code') {
      if (customer.phoneVerified) return error(409, 'phone_already_verified');
      return [200, { data: codeSent(locale, customer.phone) }];
    }
    if (method === 'POST' && pathname === '/auth/phone/verify') {
      if (customer.phoneVerified) return error(409, 'phone_already_verified');
      if (String(values.code ?? '') !== CODE) return error(422, 'invalid_code');
      customer.phoneVerified = true;
      syncState(customer);
      return [200, { data: presentCustomer(customer) }];
    }
    if (method === 'GET' && pathname === '/account/profile') return [200, { data: profile(customer, locale) }];
    if (method === 'PUT' && pathname === '/account/profile') {
      const input = values.values && typeof values.values === 'object' ? values.values : {};
      const form = profileFields(customer, locale);
      const fields = {};
      const get = (name) => (input[name] === undefined || input[name] === null ? null : String(input[name]).trim());
      for (const f of form) {
        if (!f.editable) continue;
        const value = get(f.name);
        if (f.required && value === '') fields[f.name] = [t.required(f.label)];
      }
      const phone = form.find((f) => f.name === 'phone')?.editable ? get('phone') : null;
      if (phone && !isPhone(phone)) fields.phone = [t.phoneFormat];
      const email = form.find((f) => f.name === 'email')?.editable ? get('email') : null;
      if (email && !isEmail(email)) fields.email = [t.emailFormat];
      if (Object.keys(fields).length) return error(422, 'validation_failed', { fields });
      let nextStep = null;
      if (phone && phone !== customer.phone) {
        const other = byPhone(phone);
        if (other && other !== customer && other.phoneVerified) return error(409, 'phone_in_use');
        customer.phone = phone;
        customer.phoneVerified = false;
        nextStep = 'verify_phone';
      }
      if (email && email !== customer.email) {
        if (byEmail(email)) return error(409, 'email_in_use');
        pendingEmails.set(customer.id, email);
        nextStep = nextStep ?? 'verify_email';
      }
      if (get('firstName')) customer.firstName = get('firstName');
      if (get('lastName')) customer.lastName = get('lastName');
      if (form.some((f) => f.name === 'birthdate') && input.birthdate !== undefined) customer.birthdate = get('birthdate') || null;
      syncState(customer);
      return [200, { data: profile(customer, locale, nextStep) }];
    }
    if (method === 'PUT' && pathname === '/account/password') {
      const current = String(values.currentPassword ?? '');
      const fresh = String(values.newPassword ?? '');
      const fields = {};
      if (!current) fields.currentPassword = [t.required(t.labels.password)];
      if (fresh.length < 8) fields.newPassword = [t.passwordShort];
      if (Object.keys(fields).length) return error(422, 'validation_failed', { fields });
      if (customer.password !== current) return error(403, 'wrong_password');
      customer.password = fresh;
      return [200, { data: { message: t.passwordChanged } }];
    }
    return null;
  }

  reset();
  return {
    handle,
    reset,
    /**
     * Test control `POST /__session {"revoke": "<token>"}`: the customer signed out on another device
     * (the backend's sign-out revokes every token issued before it): that token answers 401 on every
     * v3 path from now on, `GET /me` included. An expired or unknown token needs no control: any
     * token the mock never issued reads as anonymous on `GET /me` and 401 on the customer's endpoints.
     */
    control(method, pathname, body) {
      if (method !== 'POST' || pathname !== '/__session') return null;
      const token = typeof body?.revoke === 'string' ? body.revoke : '';
      if (!token) return [422, { error: { code: 'validation_failed', message: 'revoke: a token' } }];
      revoked.add(token);
      return [200, { revoked: [...revoked] }];
    },
    mode: (modeBody) => setMode(modeBody?.auth),
    /** For tests: the customer behind a token. */
    customerOf: (token) => tokens.get(token) ?? null,
    settings,
  };
}
