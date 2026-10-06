/**
 * Mock module: the customer's insurance profiles (contract: InsurancePage, InsuranceProfile,
 * InsuranceProfileRequest; design: phase-b-v3-design.md §4). Customer token only (guests → 401); 404
 * while the store takes no insurance prescriptions, and for a profile that is not the customer's.
 *   GET    /insurance                     → InsurancePageResponse
 *   POST   /insurance/profiles            → 201 InsuranceProfileSavedResponse | 422 validation_failed
 *   PUT    /insurance/profiles/{id}       → InsuranceProfileSavedResponse (numbers and photos not sent stay)
 *   DELETE /insurance/profiles/{id}       → InsuranceProfileDeletedResponse
 * The mock store asks for the national ID as a number and the insurance card as photos. The seeded customer
 * has one profile (Misr Insurance). The prescriptions module offers the `insurance` kind while this is on.
 * Off by default, as on staging. Switches: POST /__mode {"insurance": {"on": true | false}}.
 * Test scaffolding only: the real rules are the backend's.
 */

const COMPANIES = [
  { id: 1, name: { en: 'Misr Insurance', ar: 'مصر للتأمين' }, logo: null },
  { id: 2, name: { en: 'AXA', ar: 'أكسا' }, logo: null },
];

const TEXT = {
  en: {
    title: 'Insurance', hint: 'Add your insurance details once, then choose them when you send an insurance prescription.',
    company: 'Insurance company', name: 'Beneficiary name', nationalId: 'National ID number', insuranceCardFiles: 'Insurance card photos', frontBack: 'Front and back.',
    saved: 'Your insurance details were saved.', deleted: 'Your insurance details were deleted.', required: 'This field is required.', chooseCompany: 'Choose one of the insurance companies.',
    filesAgain: 'Please upload the photos again.', errors: { not_found: 'Not found.', unauthenticated: 'Please start a session first.', validation_failed: 'Please check the highlighted fields.' },
  },
  ar: {
    title: 'التأمين', hint: 'أضف بيانات تأمينك مرة واحدة، ثم اخترها عند إرسال روشتة تأمين.',
    company: 'شركة التأمين', name: 'اسم المستفيد', nationalId: 'الرقم القومي', insuranceCardFiles: 'صور كارت التأمين', frontBack: 'الوجه والظهر.',
    saved: 'تم حفظ بيانات التأمين.', deleted: 'تم حذف بيانات التأمين.', required: 'هذا الحقل مطلوب.', chooseCompany: 'اختر إحدى شركات التأمين.',
    filesAgain: 'يرجى رفع الصور مرة أخرى.', errors: { not_found: 'غير موجود.', unauthenticated: 'يرجى بدء جلسة أولاً.', validation_failed: 'يرجى مراجعة الحقول المحددة.' },
  },
};

const STATES = new WeakMap();

/** The insurance switch and profiles of the shopper store, shared with the prescriptions module. */
export function insuranceState(shopper) {
  let state = STATES.get(shopper);
  if (state) return state;
  let mode = { on: false };
  let nextId = 20;
  state = {
    get on() {
      return mode.on;
    },
    mode: () => ({ ...mode }),
    setMode(input) {
      mode = { ...mode, ...input };
    },
    reset() {
      mode = { on: false };
      nextId = 20;
    },
    rows(session) {
      if (session.insurance === undefined) {
        session.insurance = session === shopper.session('test-customer') ? [{ id: 7, companyId: 1, name: 'Mona Ali', nationalId: '29001011234567', documents: 2 }] : [];
      }
      return session.insurance;
    },
    nextId: () => nextId++,
    /** `InsuranceProfile` */
    present(row, locale) {
      const company = COMPANIES.find((c) => c.id === row.companyId);
      const companyName = company ? company.name[locale] : TEXT[locale].title;
      return {
        id: String(row.id),
        label: row.name ? `${companyName} — ${row.name}` : companyName,
        company: company ? { id: company.id, name: companyName, logo: company.logo } : null,
        name: row.name ?? null,
        nationalId: row.nationalId ? `•••• ${row.nationalId.slice(-4)}` : null,
        insuranceNumber: null,
        documents: row.documents,
      };
    },
  };
  STATES.set(shopper, state);
  return state;
}

export function createInsuranceModule(shopper) {
  const state = insuranceState(shopper);
  const error = (status, code, locale, fields) => [status, { error: { code, message: TEXT[locale].errors[code] ?? code, ...(fields ? { fields } : {}) } }];

  function page(session, locale) {
    const t = TEXT[locale];
    const field = (name, label, kind, required, extra = {}) => ({ name, label, kind, required, placeholder: null, options: [], multiple: false, hint: null, maxLength: null, ...extra });
    return {
      title: t.title,
      hint: t.hint,
      fields: [
        field('companyId', t.company, 'select', true, { options: COMPANIES.map((c) => ({ value: String(c.id), label: c.name[locale], selected: false })) }),
        field('name', t.name, 'text', false, { maxLength: 255 }),
        field('nationalId', t.nationalId, 'text', true, { maxLength: 50 }),
        field('insuranceCardFiles', t.insuranceCardFiles, 'file', true, { multiple: true, hint: t.frontBack }),
      ],
      items: state.rows(session).map((row) => state.present(row, locale)),
    };
  }

  function save(session, locale, body, existing) {
    const t = TEXT[locale];
    const input = body && typeof body === 'object' ? body : {};
    const fields = {};
    const companyId = Number(input.companyId);
    if (!COMPANIES.some((c) => c.id === companyId)) fields.companyId = [t.chooseCompany];
    const nationalId = typeof input.nationalId === 'string' && input.nationalId.trim() ? input.nationalId.trim() : null;
    if (!nationalId && !existing) fields.nationalId = [t.required];
    const files = Array.isArray(input.insuranceCardFiles) ? input.insuranceCardFiles : [];
    if (files.length > 2 || files.some((id) => typeof id !== 'string' || !session.uploads?.has(id))) fields.insuranceCardFiles = [t.filesAgain];
    else if (!files.length && !existing) fields.insuranceCardFiles = [t.required];
    if (Object.keys(fields).length) return error(422, 'validation_failed', locale, fields);

    const name = typeof input.name === 'string' && input.name.trim() ? input.name.trim() : null;
    let row = existing;
    if (row) Object.assign(row, { companyId, name, nationalId: nationalId ?? row.nationalId, documents: files.length || row.documents });
    else {
      row = { id: state.nextId(), companyId, name, nationalId, documents: files.length };
      state.rows(session).push(row);
    }
    return [existing ? 200 : 201, { data: { message: t.saved, profile: state.present(row, locale), page: page(session, locale) } }];
  }

  return {
    handle({ method, pathname, token, locale, body }) {
      if (pathname !== '/insurance' && !pathname.startsWith('/insurance/')) return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!state.on) return error(404, 'not_found', locale);
      if (method === 'GET' && pathname === '/insurance') return [200, { data: page(session, locale) }];
      if (method === 'POST' && pathname === '/insurance/profiles') return save(session, locale, body, null);
      const match = pathname.match(/^\/insurance\/profiles\/(\d+)$/);
      const rows = state.rows(session);
      const row = match ? rows.find((r) => String(r.id) === match[1]) : null;
      if (!row) return error(404, 'not_found', locale);
      if (method === 'PUT') return save(session, locale, body, row);
      if (method === 'DELETE') {
        rows.splice(rows.indexOf(row), 1);
        return [200, { data: { message: TEXT[locale].deleted, page: page(session, locale) } }];
      }
      return error(404, 'not_found', locale);
    },
    /** POST /__mode {"insurance": {...}} */
    mode(body) {
      if (body && typeof body.insurance === 'object' && body.insurance) state.setMode(body.insurance);
      return { insurance: state.mode() };
    },
    decorate(endpoint, data) {
      return endpoint === 'layout' ? { ...data, features: { ...data.features, insurance: state.on } } : data;
    },
    reset() {
      state.reset();
    },
  };
}
