/**
 * Mock module: content pages (contract: "content" in the description).
 *   GET  /pages/{slug}                → PageResponse (about-us, privacy-policy, terms-and-conditions, cookie-policy, contact, branches; else 404)
 *   GET  /branches                    → BranchesResponse
 *   POST /contact                     → 201 MessageResponse | 422 validation_failed
 *   GET  /landing-pages/{slug}        → LandingPageResponse (summer-sale; else 404)
 *   GET  /forms/{slug}                → FormResponse (feedback: every kind of field; prescriptions: one file; else 404)
 *   POST /forms/{slug}/responses      → 201 MessageResponse | 401 | 404 | 422 (validated like the backend's FormDefinition)
 * Not in the contract (test scaffolding):
 *   GET  /__content                   → the contact messages and form answers received
 * Texts are written like the backend writes them (both languages); file fields accept the ids that
 * POST /uploads (checkout module) issued to the same shopper.
 */
import fs from 'node:fs';
import path from 'node:path';

const fixture = (name) => JSON.parse(fs.readFileSync(path.resolve('src/test/fixtures/v3', name), 'utf8')).data;

const HOME = { en: 'Home', ar: 'الرئيسية' };

const ERRORS = {
  en: {
    required: 'This field is required.', email: 'Enter a valid e-mail address.', option: 'Choose one of the options.', file: 'Please upload the file again.',
    validation_failed: 'Please check the highlighted fields.', not_found: 'Not found.', unauthenticated: 'Please start a session first.',
  },
  ar: {
    required: 'هذا الحقل مطلوب.', email: 'أدخل بريدًا إلكترونيًا صحيحًا.', option: 'اختر أحد الخيارات.', file: 'يرجى رفع الملف مرة أخرى.',
    validation_failed: 'يرجى مراجعة الحقول المحددة.', not_found: 'غير موجود.', unauthenticated: 'يرجى بدء جلسة أولاً.',
  },
};

const SENT = {
  contact: { en: 'Thank you, we received your message and will get back to you soon.', ar: 'شكرًا لك، لقد استلمنا رسالتك وسنتواصل معك قريبًا.' },
  form: { en: 'Thank you, we received your answers.', ar: 'شكرًا لك، لقد استلمنا إجاباتك.' },
};

/** CMS rows: html is already cleaned (the backend's RichText). */
const PAGES = {
  'about-us': {
    title: { en: 'About Us', ar: 'عن الشركة' },
    html: {
      // An h1 in the text, like the staging CMS ("About Us – Seif Pharmacies"): shown as an h2.
      en: '<h1>About Us – Seif Pharmacies</h1><h2>Who we are</h2><p>Seif Pharmacies is one of the <strong>leading</strong> pharmacy chains in Egypt.</p><ul><li>Over 60 branches</li><li>Licensed pharmacists</li></ul><p><a href="https://example.com/story" target="_blank" rel="noreferrer noopener">Our story</a></p>',
      ar: '<h1>من نحن – صيدليات سيف</h1><h2>من نحن</h2><p>تُعد صيدليات سيف واحدة من <strong>السلاسل الصيدلية الرائدة</strong> في مصر.</p><ul><li>أكثر من 60 فرعًا</li><li>صيادلة مرخصون</li></ul>',
    },
    showTitle: true,
    about: null,
  },
  'privacy-policy': { title: { en: 'Privacy Policy', ar: 'سياسة الخصوصية' }, html: { en: '<p>We protect your personal data.</p>', ar: '<p>نحن نحمي بياناتك الشخصية.</p>' }, showTitle: false, about: 'Privacy policy' },
  'terms-and-conditions': { title: { en: 'Terms And Conditions', ar: 'الأحكام والشروط' }, html: { en: '<p>By using this store you agree to these terms.</p>', ar: '<p>باستخدامك للمتجر فإنك توافق على هذه الشروط.</p>' }, showTitle: false, about: 'Terms and conditions' },
  'cookie-policy': { title: { en: 'Cookie Policy', ar: 'سياسة ملفات الارتباط' }, html: { en: '<p>We use cookies to run the store.</p>', ar: '<p>نستخدم ملفات الارتباط لتشغيل المتجر.</p>' }, showTitle: false, about: 'Cookie policy' },
};

const CONTACT_FIELDS = [
  { name: 'name', kind: 'text', label: { en: 'Name', ar: 'الاسم' }, required: true, maxLength: 255 },
  { name: 'phone', kind: 'phone', label: { en: 'Phone', ar: 'رقم الهاتف' }, required: true, maxLength: 32 },
  { name: 'email', kind: 'email', label: { en: 'E-mail', ar: 'البريد الإلكتروني' }, required: false, maxLength: 255 },
  { name: 'subject', kind: 'text', label: { en: 'Subject', ar: 'الموضوع' }, required: false, maxLength: 255 },
  { name: 'message', kind: 'textarea', label: { en: 'Message', ar: 'الرسالة' }, required: true, maxLength: 5000 },
];

const BRANCH_GROUPS = [
  {
    name: { en: 'Stores', ar: 'ستورز' },
    branches: [
      { id: 2, name: { en: 'Shubra Pharmacy', ar: 'صيدلية شبرا 1' }, address: { en: '41 Shubra Street', ar: '41 شارع شبرا' }, area: { en: 'Down Town', ar: 'وسط البلد' }, phone: '0225778800 / 01227744387', email: 'shoubra@seifgroup.com', mapUrl: 'https://g.co/kgs/q3V9Wsw', location: { latitude: 30.0658722, longitude: 31.2451537 } },
      { id: 4, name: { en: 'Master Pharmacy', ar: 'صيدلية ماستر الصحراوى' }, address: { en: 'Cairo-Alexandria Desert Road', ar: 'طريق القاهرة-الاسكندرية الصحراوى' }, area: { en: 'Alexandria', ar: 'الاسكندرية' }, phone: '01117708839', email: null, mapUrl: 'https://www.google.com/maps?q=30.3954787,30.3752689', location: { latitude: 30.3954787, longitude: 30.3752689 } },
    ],
  },
  {
    name: { en: 'Branches', ar: 'الفروع' },
    branches: [{ id: 9, name: { en: 'Maadi Pharmacy', ar: 'صيدلية المعادي' }, address: null, area: { en: 'Maadi', ar: 'المعادي' }, phone: null, email: null, mapUrl: null, location: null }],
  },
];

const FORMS = {
  feedback: {
    title: { en: 'Feedback', ar: 'رأيك يهمنا' },
    showTitle: true,
    submit: { en: 'Send feedback', ar: 'أرسل رأيك' },
    fields: [
      { name: 'firstName', kind: 'text', label: { en: 'First name', ar: 'الاسم الأول' }, required: true, maxLength: 255 },
      { name: 'phone', kind: 'phone', label: { en: 'Phone', ar: 'رقم الهاتف' }, required: true, maxLength: 255 },
      { name: 'email', kind: 'email', label: { en: 'E-mail', ar: 'البريد الإلكتروني' }, required: false, maxLength: 255 },
      { name: 'field1', kind: 'select', label: { en: 'Branch', ar: 'الفرع' }, required: true, options: [['shubra', { en: 'Shubra', ar: 'شبرا' }], ['obour', { en: 'Obour', ar: 'العبور' }]] },
      { name: 'field2', kind: 'select', multiple: true, label: { en: 'Topics', ar: 'المواضيع' }, required: false, options: [['prices', { en: 'Prices', ar: 'الأسعار' }], ['service', { en: 'Service', ar: 'الخدمة' }]] },
      { name: 'field3', kind: 'textarea', label: { en: 'Your message', ar: 'رسالتك' }, required: true, maxLength: 5000 },
      { name: 'field4', kind: 'file', label: { en: 'Photo', ar: 'صورة' }, required: false },
    ],
  },
  prescriptions: {
    title: { en: 'Prescriptions', ar: 'الوصفات الطبية' },
    showTitle: false,
    submit: { en: 'Prescriptions', ar: 'الوصفات الطبية' },
    fields: [{ name: 'field1', kind: 'file', label: { en: 'Prescriptions', ar: 'الوصفات الطبية' }, required: true }],
  },
};

const LANDING = { 'summer-sale': { title: { en: 'Summer sale', ar: 'تخفيضات الصيف' } } };

function seo(locale, title, target, schemaType = 'WebPage', about = null) {
  const webPage = { schemaType, name: title, description: null };
  if (about) webPage.about = [about];
  return {
    title,
    description: null,
    canonical: target,
    alternates: ['en', 'ar'].map((code) => ({ locale: code, target })),
    index: true,
    breadcrumbs: [{ label: HOME[locale], target: { type: 'home' } }, { label: title, target: null }],
    structuredData: { webPage },
  };
}

function formField(field, locale) {
  return {
    name: field.name,
    label: field.label[locale],
    kind: field.kind,
    required: field.required,
    placeholder: null,
    options: (field.options ?? []).map(([value, label]) => ({ value, label: label[locale], selected: false })),
    multiple: Boolean(field.multiple),
    hint: null,
    maxLength: field.maxLength ?? null,
  };
}

export function page(slug, locale) {
  const target = { type: 'page', slug };
  if (slug === 'contact') {
    const title = { en: 'Contact us', ar: 'تواصل معنا' }[locale];
    return {
      slug, title, showTitle: true, kind: 'contact',
      content: { html: locale === 'ar' ? '<p>مواعيد العمل: الأحد-الخميس من 10 صباحًا وحتى 6 مساءً</p>' : '<p>We’re there every sunday to thursday 10 AM - 6 PM</p>' },
      iframeUrl: null,
      seo: seo(locale, title, target, 'ContactPage'),
      contact: { hotline: '19199', email: 'info@seif-online.com', address: null, whatsapp: '201221919919', fields: CONTACT_FIELDS.map((field) => formField(field, locale)) },
    };
  }
  if (slug === 'branches') {
    const title = { en: 'Our branches', ar: 'فروعنا' }[locale];
    return { slug, title, showTitle: true, kind: 'branches', content: null, iframeUrl: null, seo: seo(locale, title, target), contact: null };
  }
  const row = PAGES[slug];
  if (!row) return null;
  return { slug, title: row.title[locale], showTitle: row.showTitle, kind: 'content', content: { html: row.html[locale] }, iframeUrl: null, seo: seo(locale, row.title[locale], target, 'WebPage', row.about), contact: null };
}

export function branches(locale) {
  return {
    groups: BRANCH_GROUPS.map((group) => ({
      name: group.name[locale],
      branches: group.branches.map((b) => ({ id: b.id, name: b.name[locale], address: b.address?.[locale] ?? null, area: b.area?.[locale] ?? null, phone: b.phone, email: b.email, image: null, mapUrl: b.mapUrl, location: b.location })),
    })),
  };
}

export function form(slug, locale) {
  const row = FORMS[slug];
  if (!row) return null;
  return {
    slug, title: row.title[locale], showTitle: row.showTitle, submitLabel: row.submit[locale], requiresSignIn: true,
    fields: row.fields.map((field) => formField(field, locale)),
    seo: seo(locale, row.title[locale], { type: 'form', slug }),
  };
}

export function landingPage(slug, locale) {
  const row = LANDING[slug];
  if (!row) return null;
  const home = fixture(`home.${locale}.json`);
  return {
    slug,
    title: row.title[locale],
    seo: seo(locale, row.title[locale], { type: 'landing_page', slug }),
    promoBanners: home.promoBanners.slice(0, 1),
    sections: home.sections.slice(0, 2),
  };
}

/** Checks values against a field list the way the backend does; answers {errors, clean}. */
function check(fields, values, locale, uploads) {
  const t = ERRORS[locale];
  const errors = {};
  const clean = {};
  for (const field of fields) {
    let value = values?.[field.name];
    let error = null;
    if (field.kind === 'select') {
      const chosen = Array.isArray(value) ? value : value ? [value] : [];
      const allowed = field.options.map(([option]) => option);
      if ((!field.multiple && chosen.length > 1) || chosen.some((item) => !allowed.includes(item))) error = 'option';
      else if (field.required && !chosen.length) error = 'required';
      value = chosen;
    } else if (field.kind === 'file') {
      if (value && !(typeof value === 'string' && uploads?.has(value))) error = 'file';
      else if (field.required && !value) error = 'required';
    } else {
      value = typeof value === 'string' ? value.trim() : '';
      if (field.required && !value) error = 'required';
      else if (value && field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) error = 'email';
    }
    if (error) errors[field.name] = [t[error]];
    else clean[field.name] = value;
  }
  return { errors, clean };
}

export function createContentModule(shopper) {
  let received = { contact: [], forms: [] };
  const error = (status, code, locale, fields) => [status, { error: { code, message: ERRORS[locale][code], ...(fields ? { fields } : {}) } }];

  return {
    handle({ method, pathname, token, locale, body }) {
      if (pathname === '/__content' && method === 'GET') return [200, received];

      let match = pathname.match(/^\/pages\/([^/]+)$/);
      if (match && method === 'GET') {
        const found = page(decodeURIComponent(match[1]), locale);
        return found ? [200, { data: found }] : error(404, 'not_found', locale);
      }
      if (pathname === '/branches' && method === 'GET') return [200, { data: branches(locale) }];
      if (pathname === '/contact' && method === 'POST') {
        const { errors, clean } = check(CONTACT_FIELDS, body?.values, locale);
        if (Object.keys(errors).length) return error(422, 'validation_failed', locale, errors);
        received.contact.push(clean);
        return [201, { data: { message: SENT.contact[locale] } }];
      }
      match = pathname.match(/^\/landing-pages\/([^/]+)$/);
      if (match && method === 'GET') {
        const found = landingPage(decodeURIComponent(match[1]), locale);
        return found ? [200, { data: found }] : error(404, 'not_found', locale);
      }
      match = pathname.match(/^\/forms\/([^/]+)(\/responses)?$/);
      if (match && method === 'GET' && !match[2]) {
        const found = form(decodeURIComponent(match[1]), locale);
        return found ? [200, { data: found }] : error(404, 'not_found', locale);
      }
      if (match && method === 'POST' && match[2]) {
        const session = shopper.session(token);
        if (!session) return error(401, 'unauthenticated', locale);
        const row = FORMS[decodeURIComponent(match[1])];
        if (!row) return error(404, 'not_found', locale);
        const { errors, clean } = check(row.fields, body?.values, locale, session.uploads);
        if (Object.keys(errors).length) return error(422, 'validation_failed', locale, errors);
        received.forms.push({ slug: match[1], token, values: clean });
        return [201, { data: { message: SENT.form[locale] } }];
      }
      return null;
    },
    reset() {
      received = { contact: [], forms: [] };
    },
  };
}
