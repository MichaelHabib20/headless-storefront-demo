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
  await open(page, `/${locale}/sign-in`);
  await page.getByTestId('sign-in-form').getByRole('textbox').first().fill(phone);
  await page.getByTestId('sign-in-form').locator('input[name="password"]').fill(password);
  await page.getByTestId('sign-in-form').getByRole('button').click();
}

test.beforeEach(async ({ page }) => {
  await resetMock(page);
  await acceptCookies(page);
});

test.describe('sign in', () => {
  test('signs in by phone (the store’s login method), keeps the session in httpOnly cookies and shows the name in the header', async ({ page, context, request }) => {
    await open(page, '/en/sign-in');
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
    await page.getByTestId('sign-in-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/ar\/account$/);
    await expect(page.getByTestId('account-page')).toContainText('Test Customer');
  });

  test('comes back to the page that asked for the sign-in', async ({ page }) => {
    await open(page, '/en/account/orders');
    await page.getByTestId('account-sign-in').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\?next=/);
    await page.locator('input[name="identifier"]').fill(PHONE);
    await page.locator('input[name="password"]').fill(PASSWORD);
    await page.getByTestId('sign-in-form').getByRole('button').click();
    await expect(page).toHaveURL(/\/en\/account\/orders$/);
  });

  test('merges the guest cart into the customer on sign-in', async ({ page, context, request }) => {
    const customerCart = await request.get(`${MOCK_API}/api/customer/v3/cart`, { headers: { Authorization: 'Bearer test-customer' } });
    const owned = ((await customerCart.json()).data.items as { product: { slug: string } }[]).map((line) => line.product.slug);
    await open(page, '/en');
    // a product the customer has no line for yet (the merge keeps one line per product)
    await page
      .getByTestId('product-card')
      .filter({ has: page.getByRole('button', { name: 'Add to cart', disabled: false }) })
      .filter({ hasNot: page.locator(owned.map((slug) => `a[href="/en/p/${encodeURIComponent(slug)}"]`).join(', ')) })
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
    await open(page, '/en/sign-in');
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
    await open(page, '/en/sign-up');
    const form = page.getByTestId('sign-up-form');
    // the store's fields, in its order, plus our confirmation
    await expect(form.locator('input:not([type=hidden])')).toHaveCount(7);
    expect(await form.locator('input:not([type=hidden])').evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).name))).toEqual(['firstName', 'lastName', 'phone', 'email', 'password', 'passwordConfirmation', 'birthdate']);
    await expect(form.getByLabel(/Email/)).not.toHaveAttribute('required', '');

    await form.locator('input[name="firstName"]').fill('Sara');
    await form.locator('input[name="phone"]').fill('123');
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('different');
    await form.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('The passwords do not match.')).toBeVisible(); // ours: checked before the backend
    // passwords are never sent back to the page, so both inputs are typed again
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('longenough');
    await form.getByRole('button', { name: 'Create account' }).click();
    // the backend's messages, under the fields by their v3 names
    await expect(form.locator('[data-field="lastName"]')).toContainText('Last name is required.');
    await expect(form.locator('[data-field="phone"]')).toContainText('Enter a mobile number of 11 digits.');
    await expect(form.locator('input[name="firstName"]')).toHaveValue('Sara');

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

  test('sends the new customer to verify the phone when the store asks for it', async ({ page, request }) => {
    await mode(request, { verifyPhoneAfterSignup: true });
    await open(page, '/ar/sign-up');
    const form = page.getByTestId('sign-up-form');
    await form.locator('input[name="firstName"]').fill('سارة');
    await form.locator('input[name="lastName"]').fill('حسن');
    await form.locator('input[name="phone"]').fill('01555555556');
    await form.locator('input[name="password"]').fill('longenough');
    await form.locator('input[name="passwordConfirmation"]').fill('longenough');
    await form.getByRole('button').click();

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
    await open(page, '/en/sign-up');
    await expect(page.getByTestId('sign-up-closed')).toHaveText('This store does not accept new accounts at the moment.');
    await open(page, '/en/sign-in');
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

test.describe('password reset', () => {
  test('by SMS: forgot → code + new password → signed in', async ({ page }) => {
    await open(page, '/en/sign-in');
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page.getByTestId('forgot-password-page')).toContainText('Enter your phone number');
    await page.locator('input[name="identifier"]').fill(PHONE);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/en\/reset-password\?phone=01222353123$/);
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
    await open(page, '/en/forgot-password');
    await expect(page.getByTestId('forgot-password-page')).toContainText('Enter your e-mail address');
    await page.locator('input[name="identifier"]').fill('test@example.com');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByTestId('reset-link-sent')).toContainText('a reset link is on its way');

    await open(page, '/en/reset-password');
    await expect(page.getByTestId('reset-link-invalid')).toContainText('This reset link is not complete.');
    await open(page, '/en/reset-password?token=reset-token-ok&email=test%40example.com');
    await expect(page.locator('input[name="phone"]')).toHaveCount(0);
    await page.locator('input[name="password"]').fill('newsecret1');
    await page.locator('input[name="passwordConfirmation"]').fill('newsecret1');
    await page.getByRole('button', { name: 'Save and sign in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);
  });

  test('says to contact the store when no reset method is configured', async ({ page, request }) => {
    await mode(request, { passwordReset: 'none' });
    await open(page, '/ar/sign-in');
    await expect(page.getByRole('link', { name: 'نسيت كلمة المرور؟' })).toHaveCount(0);
    await open(page, '/ar/forgot-password');
    await expect(page.getByTestId('reset-unavailable')).toContainText('تواصل معنا');
  });
});

test.describe('waiting for approval', () => {
  test('replaces the shop with the waiting notice until the merchant approves', async ({ page, request }) => {
    await mode(request, { approval: true });
    await signIn(page, 'en', '01000000002');
    await expect(page).toHaveURL(/\/en\/waiting-approval$/);
    await expect(page.getByTestId('approval-status')).toHaveAttribute('data-status', 'pending');
    await open(page, '/en');
    await expect(page.getByTestId('approval-gate')).toContainText('Your account is being reviewed');
    await expect(page.getByTestId('home-section')).toHaveCount(0);
    await open(page, '/en/waiting-approval');
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

    await open(page, '/en/verify-email?email=tess%40example.com&token=email-token-ok');
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
    await open(page, '/en/account/password');
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

  test('a guest gets the sign-in prompt on the account pages, without a guest session being started', async ({ page, context }) => {
    await context.clearCookies();
    await open(page, '/en/account/password');
    await expect(page.getByTestId('account-sign-in')).toBeVisible();
    expect(await cookie(context, 'sc_guest')).toBeNull();
  });
});
