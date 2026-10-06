/**
 * Mock module: the customer's refund bank details (contract: BankDetails; design: phase-b-v3-design.md §5).
 * Customer token only (guests → 401); 404 while off.
 *   GET /account/bank-details → BankDetailsResponse
 *   PUT /account/bank-details → BankDetailsSavedResponse | 422 validation_failed
 * The mock store asks for a bank account (no post-office option). The seeded customer has a bank and an IBAN.
 * Off by default, as on staging. Switches: POST /__mode {"bankDetails": {"on": true | false}}.
 * Test scaffolding only: the real rules are the backend's.
 */

const TEXT = {
  en: { title: 'Bank details', hint: 'Where we send your money back when an order is refunded.', fullName: 'Account holder full name', bankName: 'Bank name', iban: 'IBAN', swiftCode: 'SWIFT code', saved: 'Your bank details were saved.', required: 'This field is required.', errors: { not_found: 'Not found.', unauthenticated: 'Please start a session first.', validation_failed: 'Please check the highlighted fields.' } },
  ar: { title: 'البيانات البنكية', hint: 'حيث نرسل أموالك عند استرداد قيمة طلب.', fullName: 'الاسم الكامل لصاحب الحساب', bankName: 'اسم البنك', iban: 'رقم IBAN', swiftCode: 'رمز SWIFT', saved: 'تم حفظ بياناتك البنكية.', required: 'هذا الحقل مطلوب.', errors: { not_found: 'غير موجود.', unauthenticated: 'يرجى بدء جلسة أولاً.', validation_failed: 'يرجى مراجعة الحقول المحددة.' } },
};
const NAMES = ['fullName', 'bankName', 'iban', 'swiftCode'];

export function createBankDetailsModule(shopper) {
  let mode = { on: false };
  const error = (status, code, locale, fields) => [status, { error: { code, message: TEXT[locale].errors[code], ...(fields ? { fields } : {}) } }];
  const record = (session) => {
    if (session.bankDetails === undefined) session.bankDetails = session === shopper.session('test-customer') ? { bankName: 'CIB', iban: 'EG380019000500000000263180002' } : {};
    return session.bankDetails;
  };
  function page(session, locale) {
    const t = TEXT[locale];
    const saved = NAMES.filter((name) => record(session)[name]).map((name) => ({ label: t[name], value: name === 'iban' ? `•••• ${record(session).iban.slice(-4)}` : record(session)[name] }));
    return {
      title: t.title,
      hint: t.hint,
      fields: NAMES.map((name) => ({ name, label: t[name], kind: 'text', required: true, placeholder: null, options: [], multiple: false, hint: null, maxLength: 255 })),
      saved: saved.length ? saved : null,
    };
  }
  return {
    handle({ method, pathname, token, locale, body }) {
      if (pathname !== '/account/bank-details') return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!mode.on) return error(404, 'not_found', locale);
      if (method === 'GET') return [200, { data: page(session, locale) }];
      if (method !== 'PUT') return error(404, 'not_found', locale);
      const input = body && typeof body === 'object' ? body : {};
      const fields = Object.fromEntries(NAMES.filter((name) => !(typeof input[name] === 'string' && input[name].trim())).map((name) => [name, [TEXT[locale].required]]));
      if (Object.keys(fields).length) return error(422, 'validation_failed', locale, fields);
      session.bankDetails = Object.fromEntries(NAMES.map((name) => [name, input[name].trim()]));
      return [200, { data: { message: TEXT[locale].saved, details: page(session, locale) } }];
    },
    /** POST /__mode {"bankDetails": {...}} */
    mode(body) {
      if (body && typeof body.bankDetails === 'object' && body.bankDetails) mode = { ...mode, ...body.bankDetails };
      return { bankDetails: { ...mode } };
    },
    decorate(endpoint, data) {
      return endpoint === 'layout' ? { ...data, features: { ...data.features, bankDetails: mode.on } } : data;
    },
    reset() {
      mode = { on: false };
    },
  };
}
