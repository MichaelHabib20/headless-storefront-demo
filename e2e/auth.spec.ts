import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test';
import { MOCK_API, acceptCookies, live, resetMock } from './support';

/**
 * Sign in / up / out, password reset, phone verification, waiting for approval, the account menu,
 * profile and password against the mock API (scripts/mock/auth.mjs). The seeded customer signs in
 * with 01222353123 / secret123; every code is 1234. Store flags are toggled with
 * POST /__mode {"auth": {...}}. Every text on screen comes from the mock backend or from i18n.
 */
test.skip(live, 'needs the stateful mock API');

const PHONE = '01222353123';
const PASSWORD = 'secret123';

async function open(page: Page, path: string) {
  const response = await page.goto(path);
  await page.waitForLoadState('networkidle');
  return response;
}

async function mode(request: APIRequestContext, auth: Record<string, unknown>) {
  await request.post(`${MOCK_API}/__mode`, { data: { auth } });
}

const cookie = async (context: BrowserContext, name: string) => (await context.cookies()).find((c) => c.name === name)?.value ?? null;

async function me(request: APIRequestContext, token: string) {
  const response = await request.get(`${MOCK_API}/api/customer/v3/me`, { headers: { Authorization: `Bearer ${token}` } });
  return (await response.json()).data as { authenticated: boolean; customer: { firstName: string } | null; counts: { cart: number }; next?: string | null };
}

async function signIn(page: Page, locale = 'en', phone = PHONE, password = PASSWORD) {
  await open(page, `/${locale}/session/signin`);
  await page.getByTestId('sign-in-form').getByRole('textbox').first().fill(phone);
  await page.getByTestId('sign-in-form').locator('input[name="password"]').fill(password);
  await page.getByTestId('sign-in-form').locator('button[type="submit"]').click();
}

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test.describe('sign in', () => {
  test('signs in by phone (the store’s login method), keeps the session in httpOnly cookies and shows the name in the header', async ({ page, context, request }) => {
    await open(page, '/en/session/signin');
    await expect(page.getByTestId('sign-in-page')).toContainText('Sign in');
    // the identifier field is the one the API said: a phone, not an e-mail
    const identifier = page.getByTestId('sign-in-form').locator('input[name="identifier"]');
    await expect(identifier).toHaveAttribute('type', 'tel');
    await expect(identifier).toHaveAttribute('maxlength', '11');
    await expect(page.getByTestId('social-sign-in')).toHaveCount(0);
    await expect(page.getByRole('tab')).toHaveCount(0);
    expect(await cookie(context, 'sc_guest')).toBeNull(); // viewing the auth pages never starts a guest

    await identifier.fill(PHONE);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId('sign-in-form').getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/en\/account$/);
    const token = await cookie(context, 'sc_token');
    expect(token).not.toBeNull();
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'sc_token')?.httpOnly).toBe(true);
    expect(cookies.find((c) => c.name === 'sc_customer')?.httpOnly).toBe(true);
    expect((await me(request, token!)).customer?.firstName).toBe('Test');
    await expect(page.getByTestId('account-menu-trigger')).toContainText('Test');
    await page.getByTestId('account-menu-trigger').click();
    await expect(page.getByTestId('account-menu-name')).toHaveText('Test Customer');
    await expect(page.getByTestId('account-menu').getByRole('link', { name: 'My profile' })).toHaveAttribute('href', '/en/account/profile');
  });

  test('shows the backend’s message for a wrong password and keeps the phone typed', async ({ page, context }) => {
    await signIn(page, 'en', PHONE, 'nope');
    await expect(page.getByTestId('sign-in-form').getByRole('alert')).toHaveText('The details you entered are not correct.');
    await expect(page.locator('input[name="identifier"]')).toHaveValue(PHONE);
    expect(await cookie(context, 'sc_token')).toBeNull();
  });

  test('signs in in Arabic with the backend’s Arabic messages', async ({ page }) => {
    await signIn(page, 'ar', PHONE, 'nope');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('sign-in-form').getByRole('alert')).toHaveText('البيانات التي أدخلتها غير صحيحة.');
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId('sign-in-form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/ar\/account$/);
    await expect(page.getByTestId('account-page')).toContainText('Test Customer');
  });

  test('comes back to the page that asked for the sign-in', async ({ page }) => {
    await open(page, '/en/account/order-history');
    await page.getByTestId('account-sign-in').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/session\/signin\?returnUrl=/);
    await page.locator('input[name="identifier"]').fill(PHONE);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId('sign-in-form').locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/account\/order-history$/);
  });

  test('merges the guest cart into the customer on sign-in', async ({ page, context, request }) => {
    const customerCart = await request.get(`${MOCK_API}/api/customer/v3/cart`, { headers: { Authorization: 'Bearer test-customer' } });
    const owned = ((await customerCart.json()).data.items as { product: { slug: string } }[]).map((line) => line.product.slug);
    await open(page, '/en');
    // a product the customer has no line for yet (the merge keeps one line per product)
    await page
      .getByTestId('product-card')
      .filter({ has: page.getByRole('button', { name: 'Add to cart', disabled: false }) })
      .filter({ hasNot: page.locator(owned.map((slug) => `a[href="/en/${encodeURIComponent(slug)}"]`).join(', ')) })
      .first()
      .getByRole('button', { name: 'Add to cart' })
      .click();
    await expect.poll(() => cookie(context, 'sc_guest')).not.toBeNull();
    const guest = (await cookie(context, 'sc_guest'))!;
    const guestCart = (await me(request, guest)).counts.cart;
    expect(guestCart).toBe(1);

    await signIn(page);
    await expect(page).toHaveURL(/\/en\/account$/);
    expect(await cookie(context, 'sc_guest')).toBeNull(); // the guest cookie is dropped after the merge
    const token = (await cookie(context, 'sc_token'))!;
    // the seeded customer had 2 lines; the guest's line is merged in
    expect((await me(request, token)).counts.cart).toBe(3);
    await expect(page.getByRole('banner')).toContainText('3');
  });

  test('offers the SMS-code tab and the social buttons only when the store configured them', async ({ page, request }) => {
    await mode(request, { otpLogin: true, social: { google: { clientId: 'google-client-id' }, facebook: { appId: 'fb-app-id' } } });
    await open(page, '/en/session/signin');
    await expect(page.getByTestId('social-sign-in')).toBeVisible();
    await expect(page.getByTestId('social-google')).toBeVisible();
    await expect(page.getByTestId('social-facebook')).toHaveText('Continue with Facebook');
    await expect(page.getByTestId('social-apple')).toHaveCount(0);

    await page.getByRole('tab', { name: 'With an SMS code' }).click();
    await page.getByTestId('otp-send-form').locator('input[name="phone"]').fill(PHONE);
    await page.getByRole('button', { name: 'Send me a code' }).click();
    await expect(page.getByTestId('otp-verify-form')).toContainText('We sent a verification code to your phone.');
    await page.locator('input[name="code"]').fill('0000');
    await page.getByRole('button', { name: 'Sign in with the code' }).click();
    await expect(page.getByTestId('otp-verify-form').getByRole('alert')).toHaveText('The code is not correct.');
    await page.locator('input[name="code"]').fill('1234');
    await page.getByRole('button', { name: 'Sign in with the code' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });
});

test.describe('sign up', () => {
  test('draws the form the API describes, shows its 422 messages, then creates the account and signs in', async ({ page, context, request }) => {
    await open(page, '/en/session/signup');
    const form = page.getByTestId('sign-up-form');
    // the store's fields, in its order, plus our confirmation
    await expect(form.locator('input:not([type=hidden])')).toHaveCount(7);
    expect(await form.locator('input:not([type=hidden])').evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).name))).toEqual(['firstName', 'lastName', 'phone', 'email', 'password', 'passwordConfirmation', 'birthdate']);
    await expect(form.getByLabel(/Email/)).not.toHaveAttribute('required', '');

    // QA 2026-10-17: every simple mistake at once (ours, checked before sending), nothing typed is lost
    await form.locator('input[name="firstName"]').fill('Sara');
    await form.locator('input[name="email"]').fill('sara-at-example');
    await form.locator('input[name="phone"]').fill('01');
    await form.locator('input[name="password"]').fill('12');
    await form.locator('input[name="passwordConfirmation"]').fill('different');
    await form.getByRole('button', { name: 'Create account' }).click();
    await expect(form.locator('[data-field="lastName"]')).toContainText('This field is required.');
    await expect(form.locator('[data-field="email"]')).toContainText('Enter a valid e-mail address.');
    await expect(form.locator('[data-field="phone"]')).toContainText('Enter a 11-digit phone number.');
    await expect(form.locator('[data-field="password"]')).toContainText('Use at least 8 characters.');
    await expect(page.getByText('The passwords do not match.')).toBeVisible();
    for (const [name, value] of [['firstName', 'Sara'], ['email', 'sara-at-example'], ['phone', '01'], ['password', '12'], ['passwordConfirmation', 'different']]) {
      await expect(form.locator(`input[name="${name}"]`)).toHaveValue(value);
    }

    // the backend's messages, under the fields by their v3 names; what was typed stays
    await form.locator('input[name="lastName"]').fill('Hassan');
    await form.locator('input[name="email"]').fill('');
    await form.locator('input[name="phone"]').fill('12345678901');
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('longenough');
    await form.getByRole('button', { name: 'Create account' }).click();
    await expect(form.locator('[data-field="phone"]')).toContainText('Enter a mobile number of 11 digits.');
    await expect(form.locator('input[name="firstName"]')).toHaveValue('Sara');
    await expect(form.locator('input[name="password"]')).toHaveValue('longenough');

    await form.locator('input[name="lastName"]').fill('Hassan');
    await form.locator('input[name="phone"]').fill('01555555555');
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('longenough');
    await form.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/en\/account$/);
    await expect(page.getByTestId('account-page')).toContainText('Sara Hassan');
    const token = (await cookie(context, 'sc_token'))!;
    expect((await me(request, token)).customer?.firstName).toBe('Sara');
  });

  test('sign-up mistakes in Arabic on a phone, all at once', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/ar/session/signup');
    const form = page.getByTestId('sign-up-form');
    await form.locator('input[name="phone"]').fill('01');
    await form.locator('button[type="submit"]').click();
    await expect(form.locator('[data-field="firstName"]')).toContainText('هذا الحقل مطلوب.');
    await expect(form.locator('[data-field="phone"]')).toContainText('أدخل رقم هاتف مكوّنًا من 11 رقمًا.');
    await expect(form.locator('input[name="phone"]')).toHaveValue('01');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('sends the new customer to verify the phone when the store asks for it', async ({ page, request }) => {
    await mode(request, { verifyPhoneAfterSignup: true });
    await open(page, '/ar/session/signup');
    const form = page.getByTestId('sign-up-form');
    await form.locator('input[name="firstName"]').fill('سارة');
    await form.locator('input[name="lastName"]').fill('حسن');
    await form.locator('input[name="phone"]').fill('01555555556');
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('longenough');
    await form.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/ar\/verify-phone$/);
    await expect(page.getByTestId('verify-phone-page')).toContainText('01555555556');
    // shopping is allowed meanwhile: the banner shows elsewhere
    await open(page, '/ar');
    await expect(page.getByTestId('verify-phone-banner')).toContainText('لم يتم التحقق من رقم هاتفك بعد.');
    await page.getByTestId('verify-phone-banner').getByRole('link').click();
    await page.locator('input[name="code"]').fill('1234');
    await page.getByTestId('verify-phone-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/ar\/account$/);
    await expect(page.getByTestId('verify-phone-banner')).toHaveCount(0);
  });

  test('says so when the store closed sign-ups', async ({ page, request }) => {
    await mode(request, { signupEnabled: false });
    await open(page, '/en/session/signup');
    await expect(page.getByTestId('sign-up-closed')).toHaveText('This store does not accept new accounts at the moment.');
    await open(page, '/en/session/signin');
    await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
  });
});

test.describe('sign out', () => {
  test('revokes the token: a later page load is anonymous and the old token answers 401', async ({ page, context, request }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/en\/account$/);
    const token = (await cookie(context, 'sc_token'))!;
    await page.getByTestId('account-page').getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/en$/);
    expect(await cookie(context, 'sc_token')).toBeNull();
    expect(await cookie(context, 'sc_customer')).toBeNull();
    await page.getByTestId('account-menu-trigger').click();
    await expect(page.getByTestId('menu-sign-in')).toBeVisible();
    const revoked = await request.get(`${MOCK_API}/api/customer/v3/account/profile`, { headers: { Authorization: `Bearer ${token}` } });
    expect(revoked.status()).toBe(401);
    await open(page, '/en/account/profile');
    await expect(page.getByTestId('account-sign-in')).toBeVisible();
  });
});

/**
 * A session ended elsewhere (signed out on another device: the backend revokes every older token) or
 * expired leaves a stale cookie behind. It must never bounce the shopper between the account and the
 * sign-in page: the cookie goes, the shopper is a guest, and the sign-in form is there.
 */
test.describe('a session that ended elsewhere', () => {
  const endedBy = {
    'signed out on another device': async (request: APIRequestContext) => {
      // browser B signs out with its own copy of the token: the mock revokes it like the backend does
      await request.post(`${MOCK_API}/__session`, { data: { revoke: 'test-customer' } });
      return 'test-customer';
    },
    expired: async () => 'expired-token',
  };

  async function staleSession(context: BrowserContext, token: string) {
    await context.addCookies([
      { name: 'sc_token', value: token, domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
      { name: 'sc_customer', value: encodeURIComponent(JSON.stringify({ id: 4550965, firstName: 'Test' })), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' },
    ]);
  }

  for (const [how, end] of Object.entries(endedBy)) {
    test(`${how}: the account sends to the sign-in form once, the cookies go, and signing in works again`, async ({ page, context, request }) => {
      await staleSession(context, await end(request));
      const response = await open(page, '/en/account');
      expect(response?.ok()).toBe(true);
      await expect(page.getByTestId('sign-in-form')).toBeVisible();
      expect(await cookie(context, 'sc_token')).toBeNull();
      expect(await cookie(context, 'sc_customer')).toBeNull();
      await page.getByTestId('account-menu-trigger').click();
      await expect(page.getByTestId('menu-sign-in')).toBeVisible();

      await signIn(page);
      await expect(page).toHaveURL(/\/en\/account$/);
      await expect(page.getByTestId('account-page')).toBeVisible();
    });
  }

  test('the sign-in page itself shows the form for a dead token (Arabic, phone width)', async ({ page, context, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await staleSession(context, await endedBy['signed out on another device'](request));
    const response = await open(page, '/ar/session/signin?returnUrl=%2Far%2Faccount%2Fprofile');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/ar\/session\/signin\?returnUrl=%2Far%2Faccount%2Fprofile$/);
    await expect(page.getByTestId('sign-in-form')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('تسجيل الدخول');
    expect(await cookie(context, 'sc_token')).toBeNull();
  });

  test('a private page shows the sign-in card in place and the cookie goes (no loop)', async ({ page, context }) => {
    await staleSession(context, 'expired-token');
    await open(page, '/en/account/profile');
    await expect(page).toHaveURL(/\/en\/account\/profile$/);
    await expect(page.getByTestId('account-sign-in')).toBeVisible();
    expect(await cookie(context, 'sc_token')).toBeNull();
  });

  test('a malformed cookie is dropped before the page renders', async ({ page, context }) => {
    await context.addCookies([
      { name: 'sc_token', value: '%7Bnot%20a%20token%7D', domain: '127.0.0.1', path: '/' },
      { name: 'sc_customer', value: '%7Bbroken', domain: '127.0.0.1', path: '/' },
    ]);
    await open(page, '/en/session/signin');
    await expect(page.getByTestId('sign-in-form')).toBeVisible();
    expect(await cookie(context, 'sc_token')).toBeNull();
    expect(await cookie(context, 'sc_customer')).toBeNull();
  });

  test('a backend that is down signs nobody out: the account shows its error and the cookie stays', async ({ page, context, request }) => {
    await staleSession(context, 'test-customer');
    // the shopper's calls fail (500); the store's layout still loads
    await request.post(`${MOCK_API}/__mode`, { data: { failPaths: ['/me', '/account/'] } });
    try {
      await page.goto('/en/account');
      await expect(page.getByTestId('account-error')).toBeVisible();
      await expect(page).toHaveURL(/\/en\/account$/);
      expect(await cookie(context, 'sc_token')).toBe('test-customer');
      await page.goto('/en/session/signin');
      await expect(page).toHaveURL(/\/en\/session\/signin$/);
      expect(await cookie(context, 'sc_token')).toBe('test-customer');
    } finally {
      await request.post(`${MOCK_API}/__mode`, { data: { failPaths: [] } });
    }
    // back up: the session still works
    await open(page, '/en/account');
    await expect(page.getByTestId('account-page')).toBeVisible();
  });

  test('a cart write with a dead token goes on as a guest', async ({ page, context, request }) => {
    await staleSession(context, await endedBy['signed out on another device'](request));
    await context.addCookies([{ name: 'sc_session_checked', value: '1', domain: '127.0.0.1', path: '/' }]);
    await open(page, '/en/products');
    await page.getByRole('button', { name: /add to cart/i }).first().click();
    await expect(page.getByRole('status').filter({ hasText: /added to (your )?cart/i }).first()).toBeVisible();
    expect(await cookie(context, 'sc_token')).toBeNull();
    expect(await cookie(context, 'sc_guest')).not.toBeNull();
  });
});

test.describe('password reset', () => {
  test('by SMS: forgot → code + new password → signed in', async ({ page }) => {
    await open(page, '/en/session/signin');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page.getByTestId('forgot-password-page')).toContainText('Enter your phone number');
    await page.locator('input[name="identifier"]').fill(PHONE);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/en\/session\/change-password\?phone=01222353123$/);
    await expect(page.locator('input[name="phone"]')).toHaveValue(PHONE);
    await page.locator('input[name="code"]').fill('9999');
    await page.locator('input[name="password"]').fill('newsecret1');
    await page.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page.getByTestId('reset-password-form').getByRole('alert')).toHaveText('The code is not correct.');
    await page.locator('input[name="code"]').fill('1234');
    await page.locator('input[name="password"]').fill('newsecret1');
    await page.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test('by e-mail: the link lands on the reset page with the token', async ({ page, request }) => {
    await mode(request, { passwordReset: 'email' });
    await open(page, '/en/session/forgot-password');
    await expect(page.getByTestId('forgot-password-page')).toContainText('Enter your e-mail address');
    await page.locator('input[name="identifier"]').fill('test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('reset-link-sent')).toContainText('a reset link is on its way');

    await open(page, '/en/session/change-password');
    await expect(page.getByTestId('reset-link-invalid')).toContainText('This reset link is not complete.');
    await open(page, '/en/session/change-password?token=reset-token-ok&email=test%40example.com');
    await expect(page.locator('input[name="phone"]')).toHaveCount(0);
    await page.locator('input[name="password"]').fill('newsecret1');
    await page.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test('says to contact the store when no reset method is configured', async ({ page, request }) => {
    await mode(request, { passwordReset: 'none' });
    await open(page, '/ar/session/signin');
    // like the old storefront the link is always there; the page says what to do
    await page.getByRole('link', { name: 'نسيت كلمة المرور؟' }).click();
    await expect(page).toHaveURL(/\/ar\/session\/forgot-password$/);
    const note = page.getByTestId('reset-unavailable');
    await expect(note).toContainText('تواصل معنا');
    await expect(note.getByRole('link', { name: 'اتصل بنا' })).toHaveAttribute('href', '/ar/pages/contact');
    await expect(note.getByRole('link', { name: 'تواصل عبر واتساب' })).toHaveAttribute('href', /^https:\/\/wa\.me\//);
    await expect(page.locator('form input[name="identifier"]')).toHaveCount(0);

    // the reset page (and English) say the same, never an empty card
    await open(page, '/en/session/change-password');
    const reset = page.getByTestId('reset-link-invalid');
    await expect(reset).toContainText('This store does not reset passwords online. Please contact us');
    await expect(reset.getByRole('link', { name: 'Contact us' })).toHaveAttribute('href', '/en/pages/contact');
    await expect(reset.getByRole('link', { name: 'Chat on WhatsApp' })).toBeVisible();
  });

  test('an e-mail store shows the full form on the forgot page (Arabic)', async ({ page, request }) => {
    await mode(request, { passwordReset: 'email' });
    await open(page, '/ar/session/forgot-password');
    await expect(page.getByTestId('reset-unavailable')).toHaveCount(0);
    await expect(page.locator('input[name="identifier"]')).toHaveAttribute('type', 'email');
    await expect(page.getByTestId('forgot-password-page').getByRole('button')).toBeEnabled();
  });
});

test.describe('show / hide password and the forgot link (old storefront parity)', () => {
  /** Checks one password input and its eye toggle: off, typed, shown, hidden again. */
  async function checkToggle(page: Page, scope: string, name: string, toggleName: string) {
    const input = page.getByTestId(scope).locator(`input[name="${name}"]`);
    const toggle = page.getByTestId(scope).getByRole('button', { name: toggleName }).and(page.locator(`[aria-controls="${await input.getAttribute('id')}"]`));
    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await input.fill('secret-typed');
    await toggle.click();
    await expect(input).toHaveAttribute('type', 'text');
    await expect(input).toHaveValue('secret-typed');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await toggle.press('Enter');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  }

  test('sign in (en): the forgot link and the toggle; the toggle does not submit and signing in still works', async ({ page }) => {
    await open(page, '/en/session/signin');
    await expect(page.getByTestId('forgot-password-link')).toHaveAttribute('href', '/en/session/forgot-password');
    await checkToggle(page, 'sign-in-form', 'password', 'Show password');
    await expect(page.getByTestId('sign-in-form').getByRole('alert')).toHaveCount(0); // nothing was submitted

    await page.locator('input[name="identifier"]').fill(PHONE);
    const password = page.locator('input[name="password"]');
    await password.fill(PASSWORD);
    await page.getByTestId('sign-in-form').getByRole('button', { name: 'Show password' }).click();
    await page.getByTestId('sign-in-form').getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/); // sent while shown as text
  });

  test('sign in (ar): Arabic link and toggle name, toggle at the start side in RTL', async ({ page }) => {
    await open(page, '/ar/session/signin');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('link', { name: 'نسيت كلمة المرور؟' })).toHaveAttribute('href', '/ar/session/forgot-password');
    await checkToggle(page, 'sign-in-form', 'password', 'إظهار كلمة المرور');
    const input = await page.locator('input[name="password"]').boundingBox();
    const toggle = await page.getByRole('button', { name: 'إظهار كلمة المرور' }).boundingBox();
    // inside the input, at its left edge (the end side in Arabic)
    expect(toggle!.x).toBeGreaterThanOrEqual(input!.x - 1);
    expect(toggle!.x + toggle!.width).toBeLessThan(input!.x + input!.width / 2);
  });

  test('sign up: the password and its confirmation each have a toggle', async ({ page }) => {
    await open(page, '/en/session/signup');
    await checkToggle(page, 'sign-up-form', 'password', 'Show password');
    await checkToggle(page, 'sign-up-form', 'passwordConfirmation', 'Show password');
  });

  test('reset (Arabic): both new password fields have a toggle', async ({ page }) => {
    await open(page, '/ar/session/change-password?phone=01222353123');
    await checkToggle(page, 'reset-password-form', 'password', 'إظهار كلمة المرور');
    await checkToggle(page, 'reset-password-form', 'passwordConfirmation', 'إظهار كلمة المرور');
  });

  test('account change password: every password field has a toggle', async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/en\/account$/);
    await open(page, '/en/account/change-password');
    for (const name of ['currentPassword', 'newPassword', 'passwordConfirmation']) await checkToggle(page, 'password-form', name, 'Show password');
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });

    test('the toggle is tappable, fits, and the forgot link is there (en and ar)', async ({ page }) => {
      for (const [locale, name] of [['en', 'Show password'], ['ar', 'إظهار كلمة المرور']] as const) {
        await open(page, `/${locale}/session/signin`);
        await expect(page.getByTestId('forgot-password-link')).toBeVisible();
        const toggle = page.getByRole('button', { name });
        const box = await toggle.boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await toggle.tap();
        await expect(page.locator('input[name="password"]')).toHaveAttribute('type', 'text');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
    });
  });
});

test.describe('waiting for approval', () => {
  test('replaces the shop with the waiting notice until the merchant approves', async ({ page, request }) => {
    await mode(request, { approval: true });
    await signIn(page, 'en', '01000000002');
    await expect(page).toHaveURL(/\/en\/session\/waiting-approval$/);
    await expect(page.getByTestId('approval-status')).toHaveAttribute('data-status', 'pending');
    await open(page, '/en');
    await expect(page.getByTestId('approval-gate')).toContainText('Your account is being reviewed');
    await expect(page.getByTestId('home-section')).toHaveCount(0);
    await open(page, '/en/session/waiting-approval');
    await page.getByTestId('waiting-approval-page').getByTestId('sign-out').click();
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByTestId('home-section').first()).toBeVisible();
  });
});

test.describe('profile and password', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test('shows the profile form from the API, the identifier read-only, and saves', async ({ page }) => {
    await open(page, '/en/account/profile');
    const form = page.getByTestId('profile-form');
    await expect(form.locator('input[name="firstName"]')).toHaveValue('Test');
    await expect(form.locator('input[name="phone"]')).toHaveValue(PHONE);
    await expect(form.locator('input[name="phone"]')).toBeDisabled();
    await expect(page.getByTestId('phone-status')).toContainText('Verified');

    await form.locator('input[name="firstName"]').fill('');
    await form.getByRole('button', { name: 'Save changes' }).click();
    await expect(form.locator('[data-field="firstName"]')).toContainText('First name is required.');

    await form.locator('input[name="firstName"]').fill('Tess');
    await form.locator('input[name="email"]').fill('tess@example.com');
    await form.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByTestId('profile-status')).toContainText('We sent a confirmation link to your new e-mail address.');
    await expect(page.getByTestId('account-menu-trigger')).toContainText('Tess');

    await open(page, '/en/session/verifyEmail?email=tess%40example.com&token=email-token-ok');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByTestId('email-verified')).toHaveText('Your e-mail address was confirmed.');
  });

  test('a changed phone (e-mail login stores) must be verified again', async ({ page, request }) => {
    await mode(request, { loginMethod: 'email' });
    await open(page, '/en/account/profile');
    const form = page.getByTestId('profile-form');
    await expect(form.locator('input[name="email"]')).toBeDisabled();
    await form.locator('input[name="phone"]').fill('01999999999');
    await form.getByRole('button', { name: 'Save changes' }).click();
    await expect(page).toHaveURL(/\/en\/verify-phone\?next=/);
    await page.locator('input[name="code"]').fill('1234');
    await page.getByTestId('verify-phone-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/en\/account\/profile$/);
    await expect(page.getByTestId('phone-status')).toContainText('01999999999');
    await expect(page.getByTestId('phone-status')).toContainText('Verified');
  });

  test('changes the password with the backend’s refusals', async ({ page }) => {
    await open(page, '/en/account/change-password');
    const form = page.getByTestId('password-form');
    await form.locator('input[name="currentPassword"]').fill('wrong');
    await form.locator('input[name="newPassword"]').fill('newsecret1');
    await form.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByRole('alert')).toHaveText('The current password is not correct.');

    await form.locator('input[name="currentPassword"]').fill(PASSWORD);
    await form.locator('input[name="newPassword"]').fill('newsecret1');
    await form.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByTestId('password-changed')).toHaveText('Your password was changed.');
  });

  // QA 2026-10-17: a refused submit emptied the three fields, and errors came one at a time
  test('change password: every mistake at once, and what was typed stays', async ({ page }) => {
    await open(page, '/en/account/change-password');
    const form = page.getByTestId('password-form');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByTestId('field-error')).toHaveText(['This field is required.', 'This field is required.', 'This field is required.']);

    await form.locator('input[name="currentPassword"]').fill('x');
    await form.locator('input[name="newPassword"]').fill('NewPass1234');
    await form.locator('input[name="passwordConfirmation"]').fill('Different1234');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByTestId('field-error')).toHaveText(['The passwords do not match.']);
    for (const [name, value] of [['currentPassword', 'x'], ['newPassword', 'NewPass1234'], ['passwordConfirmation', 'Different1234']]) {
      await expect(form.locator(`input[name="${name}"]`)).toHaveValue(value);
    }

    // refused by the backend: the fields stay too
    await form.locator('input[name="passwordConfirmation"]').fill('NewPass1234');
    await form.getByRole('button', { name: 'Change password' }).click();
    await expect(form.getByRole('alert')).toHaveText('The current password is not correct.');
    for (const [name, value] of [['currentPassword', 'x'], ['newPassword', 'NewPass1234'], ['passwordConfirmation', 'NewPass1234']]) {
      await expect(form.locator(`input[name="${name}"]`)).toHaveValue(value);
    }
  });

  test('change password in Arabic on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/ar/account/change-password');
    const form = page.getByTestId('password-form');
    await form.locator('input[name="newPassword"]').fill('short');
    await form.locator('input[name="passwordConfirmation"]').fill('other');
    await form.locator('button[type="submit"]').click();
    await expect(form.getByTestId('field-error')).toHaveText(['هذا الحقل مطلوب.', 'استخدم 8 أحرف على الأقل.', 'كلمتا المرور غير متطابقتين.']);
    await expect(form.locator('input[name="newPassword"]')).toHaveValue('short');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('a guest gets the sign-in prompt on the account pages, without a guest session being started', async ({ page, context }) => {
    await context.clearCookies();
    await open(page, '/en/account/change-password');
    await expect(page.getByTestId('account-sign-in')).toBeVisible();
    expect(await cookie(context, 'sc_guest')).toBeNull();
  });
});
