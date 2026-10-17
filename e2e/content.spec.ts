import { expect, test } from '@playwright/test';
import { MOCK_API, acceptCookies, live, signInAsCustomer } from './support';

/*
 * Content pages against the mock API (scripts/mock/content.mjs): CMS pages (EN + AR, cleaned HTML),
 * the contact page and its form, branches, a landing page, merchant forms, 404s.
 */
const API = `${MOCK_API}/api/customer/v3`;

test.skip(live, 'the content endpoints are not deployed on staging yet (mock only)');

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK_API}/__reset`);
  await acceptCookies(page);
});

test.describe('CMS pages', () => {
  test('a page in English and Arabic with the merchant text', async ({ page }) => {
    await page.goto('/en/pages/about-us');
    await expect(page.getByRole('heading', { level: 1, name: 'About Us' })).toBeVisible();
    const body = page.getByTestId('content-body');
    await expect(body.getByRole('heading', { level: 2, name: 'Who we are' })).toBeVisible();
    await expect(body.getByRole('listitem')).toHaveCount(2);
    await expect(body.getByRole('link', { name: 'Our story' })).toHaveAttribute('href', 'https://example.com/story');
    await expect(page).toHaveTitle(/About Us/);

    await page.goto('/ar/pages/about-us');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'عن الشركة' })).toBeVisible();
    await expect(page.getByTestId('content-body')).toContainText('صيدليات سيف');
  });

  test('legal pages hide their title for sighted users only', async ({ page }) => {
    await page.goto('/en/pages/privacy-policy');
    await expect(page.getByTestId('content-body')).toHaveText('We protect your personal data.');
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toHaveClass(/visually-hidden/);
  });

  test('unknown pages, landing pages and forms are 404', async ({ page }) => {
    for (const path of ['/en/pages/nope', '/en/landing-page/nope', '/ar/forms/nope']) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
    }
  });
});

test.describe('contact', () => {
  test('store details and the API validation messages, then the message is sent', async ({ page, request }) => {
    await page.goto('/en/pages/contact');
    const details = page.getByTestId('contact-details');
    await expect(details.getByRole('link', { name: '19199', exact: true })).toHaveAttribute('href', 'tel:19199');
    await expect(details.getByRole('link', { name: '201221919919' })).toHaveAttribute('href', 'https://wa.me/201221919919');

    const form = page.getByTestId('contact-form');
    await form.getByLabel(/E-mail/).fill('not-an-email');
    await form.getByRole('button', { name: 'Send' }).click();
    await expect(form.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByTestId('field-error')).toHaveText(['This field is required.', 'This field is required.', 'Enter a valid e-mail address.', 'This field is required.']);

    await form.getByLabel('Name').fill('Mona');
    await form.getByLabel('Phone').fill('01000000001');
    await form.getByLabel(/E-mail/).fill('mona@example.com');
    await form.getByLabel('Message').fill('Do you deliver to Aswan?');
    await form.getByRole('button', { name: 'Send' }).click();
    await expect(page.getByTestId('contact-form-message')).toHaveText('Thank you, we received your message and will get back to you soon.');
    await expect(form.getByLabel('Name')).toHaveValue('');

    const received = await (await request.get(`${API}/__content`)).json();
    expect(received.contact).toEqual([{ name: 'Mona', phone: '01000000001', email: 'mona@example.com', subject: '', message: 'Do you deliver to Aswan?' }]);
    // no guest session for a contact message
    expect((await page.context().cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
  });

  test('Arabic contact page', async ({ page }) => {
    await page.goto('/ar/pages/contact');
    await expect(page.getByRole('heading', { level: 1, name: 'تواصل معنا' })).toBeVisible();
    await page.getByTestId('contact-form').getByRole('button', { name: 'إرسال' }).click();
    await expect(page.getByTestId('field-error').first()).toHaveText('هذا الحقل مطلوب.');
  });
});

test.describe('branches', () => {
  test('grouped, with the map links of the API', async ({ page }) => {
    await page.goto('/en/pages/branches');
    await expect(page.getByRole('heading', { level: 1, name: 'Our branches' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Stores' })).toBeVisible();
    await expect(page.getByTestId('branch')).toHaveCount(3);
    const maps = page.getByTestId('branch-map');
    await expect(maps).toHaveCount(2);
    await expect(maps.first()).toHaveAttribute('href', 'https://g.co/kgs/q3V9Wsw');
    await expect(maps.first()).toHaveAttribute('target', '_blank');

    await page.goto('/ar/pages/branches');
    await expect(page.getByRole('heading', { level: 2, name: 'ستورز' })).toBeVisible();
  });
});

test.describe('landing page', () => {
  test('promo banner and the sections in the merchant order', async ({ page }) => {
    await page.goto('/en/landing-page/summer-sale');
    const landing = page.getByTestId('landing-page');
    await expect(landing.getByTestId('home-section')).toHaveCount(2);
    await expect(landing.locator('[data-testid^="promo-"]')).toHaveCount(1);
    await expect(page).toHaveTitle(/Summer sale/);
    await page.goto('/ar/landing-page/summer-sale');
    await expect(page.getByTestId('landing-page').getByTestId('home-section')).toHaveCount(2);
  });
});

test.describe('merchant forms', () => {
  // Like the old storefront: the form is open to visitors; a guest session (started by the upload or
  // the send, never by opening the page) is enough for the API.
  test('a visitor sends the prescriptions form: upload required, picture tile, thank you', async ({ page, request }) => {
    await page.goto('/en/forms/prescriptions');
    await expect(page.getByRole('heading', { level: 1, name: 'Prescriptions' })).toBeVisible();
    const form = page.getByTestId('merchant-form');
    await expect(form).toBeVisible();
    expect((await page.context().cookies()).find((cookie) => cookie.name === 'sc_guest')).toBeUndefined();
    await expect(form.getByText('(optional)')).toHaveCount(0);
    await expect(form.getByTestId('file-field1')).toHaveAttribute('required', '');

    // an empty prescription is not sent
    await form.locator('button[type="submit"]').click();
    await expect(form.getByTestId('field-error')).toHaveText('Please attach at least one image.');
    await expect(form.getByTestId('file-field1')).toHaveAttribute('aria-invalid', 'true');
    expect((await (await request.get(`${API}/__content`)).json()).forms).toHaveLength(0);

    const tile = form.getByTestId('file-tile');
    await expect(tile).toBeVisible();
    const box = await tile.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(150);
    // the tile opens the file chooser
    const chooser = page.waitForEvent('filechooser');
    await tile.click();
    await (await chooser).setFiles({ name: 'rx.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await expect(form.getByText('Uploaded: rx.png')).toBeVisible();
    await expect(form.getByTestId('file-preview')).toBeVisible();
    expect((await page.context().cookies()).filter((cookie) => cookie.name === 'sc_guest')).toHaveLength(1);

    await form.locator('button[type="submit"]').click();
    await expect(page.getByTestId('merchant-form-message')).toHaveText('Thank you, we received your answers.');
    const received = await (await request.get(`${API}/__content`)).json();
    expect(received.forms).toHaveLength(1);
    expect(received.forms[0]).toMatchObject({ slug: 'prescriptions' });
    expect(received.forms[0].values.field1).toMatch(/^mock-upload-/);
  });

  test('the prescriptions form in Arabic on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/forms/prescriptions');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { level: 1, name: 'الوصفات الطبية' })).toBeVisible();
    const form = page.getByTestId('merchant-form');
    const send = form.locator('button[type="submit"]');
    await expect(send).toHaveText('الوصفات الطبية');
    await send.click();
    await expect(form.getByTestId('field-error')).toHaveText('يرجى إرفاق صورة واحدة على الأقل.');
    // full-width send button, nothing wider than the screen
    const [button, card] = await Promise.all([send.boundingBox(), page.getByTestId('merchant-form').boundingBox()]);
    expect(Math.round(button!.width)).toBe(Math.round(card!.width));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await form.getByTestId('file-field1').setInputFiles({ name: 'rx.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') });
    await expect(form.getByTestId('file-tile')).toContainText('rx.pdf');
    await send.click();
    await expect(page.getByTestId('merchant-form-message')).toHaveText('شكرًا لك، لقد استلمنا إجاباتك.');
  });

  test('a signed-in shopper answers: API validation, file upload, thank you', async ({ page, context, request }) => {
    await signInAsCustomer(context);
    await page.goto('/en/forms/feedback');
    await expect(page.getByRole('heading', { level: 1, name: 'Feedback' })).toBeVisible();
    const form = page.getByTestId('merchant-form');

    await form.getByRole('button', { name: 'Send feedback' }).click();
    await expect(form.getByLabel('First name')).toHaveAttribute('aria-invalid', 'true');
    await expect(form.getByLabel('Branch')).toHaveAttribute('aria-invalid', 'true');

    await form.getByLabel('First name').fill('Mona');
    await form.getByLabel('Phone').fill('01000000001');
    await form.getByLabel('Branch').selectOption('obour');
    await form.getByLabel(/Topics/).selectOption(['prices', 'service']);
    await form.getByLabel('Your message').fill('Great service');
    await form.getByTestId('file-field4').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('png') });
    await expect(form.getByText('Uploaded: photo.png')).toBeVisible();
    await form.getByRole('button', { name: 'Send feedback' }).click();
    await expect(page.getByTestId('merchant-form-message')).toHaveText('Thank you, we received your answers.');

    const received = await (await request.get(`${API}/__content`)).json();
    expect(received.forms).toHaveLength(1);
    expect(received.forms[0].values).toMatchObject({ firstName: 'Mona', field1: ['obour'], field2: ['prices', 'service'], field3: 'Great service' });
    expect(received.forms[0].values.field4).toMatch(/^mock-upload-/);
  });

  test('Arabic form labels from the API', async ({ page, context }) => {
    await signInAsCustomer(context);
    await page.goto('/ar/forms/feedback');
    await expect(page.getByTestId('merchant-form').getByLabel('الفرع')).toBeVisible();
    await expect(page.getByRole('button', { name: 'أرسل رأيك' })).toBeVisible();
  });
});
