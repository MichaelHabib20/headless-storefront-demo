/**
 * Mock module: the customer's prescriptions (contract: PrescriptionForm, Prescription; design:
 * account-extras-v3-design.md §2). Customer token only (guests → 401); 404 while switched off.
 *   GET  /prescriptions/form                  → PrescriptionFormResponse
 *   GET  /prescriptions?page&perPage           → PrescriptionsResponse (newest first)
 *   POST /prescriptions                       → 201 PrescriptionSentResponse | 422 | 409 prescription_blocked
 *   GET  /prescriptions/cancellation-reasons  → CancellationReasonsResponse
 *   POST /prescriptions/{id}/cancel           → PrescriptionResponse | 409 cannot_cancel
 * The seeded customer ("Bearer test-customer") has #1042 (received) and #1041 (being prepared).
 * Files are ids of POST /uploads (checkout module) issued to the same session; addresses are the
 * session's address book (account-state.mjs).
 * Switches: POST /__mode {"prescriptions": {"enabled", "wasfaty", "numberMode", "phone": "ok" | "unverified" | "missing"}}.
 * Test scaffolding only: the real rules are the backend's.
 */
import { addressesOf } from './account-state.mjs';
import { insuranceState } from './insurance.mjs';

const TEXT = {
  en: {
    title: 'Prescription',
    description: '<p>Upload a clear photo of your prescription and our pharmacist will call you.</p>',
    type: 'Prescription type', number: 'Prescription number', numberHint: 'Needed for Wasfaty prescriptions.',
    files: 'Prescription photos', filesHint: 'Photos or PDF of the prescription, up to 10 files.', note: 'Notes for the pharmacist',
    kinds: { cash: 'Cash', wasfaty: 'Wasfaty', insurance: 'Insurance' },
    insuranceProfile: 'Insurance details', insuranceProfileHint: 'Add your insurance details on the insurance page first.', preApproved: 'Approval',
    preApprovedNo: 'New request', preApprovedYes: 'Already approved by the insurance company', approvalNumber: 'Approval number', invoiceFiles: 'Invoice photos',
    chooseProfile: 'Choose one of your insurance details.',
    status: { received: 'Received', in_progress: 'Being prepared', delivered: 'Delivered', cancelled: 'Cancelled' },
    blockers: {
      add_address: 'Add a delivery address first, then send your prescription.',
      add_phone: 'Add your phone number to your profile so the pharmacy can call you.',
      verify_phone: 'Verify your phone number so the pharmacy can call you.',
    },
    sent: 'Thank you! We received your prescription and will contact you soon.',
    reasons: ['Bought it elsewhere', 'Changed my mind'],
    errors: {
      validation_failed: 'Please check the highlighted fields.', not_found: 'Not found.', unauthenticated: 'Please sign in first.',
      cannot_cancel: 'This prescription can no longer be cancelled.',
    },
    required: (label) => `${label} is required.`, address: 'Choose one of your addresses.', choose: 'Choose one of the options.',
    filesAgain: 'Please upload the files again.', reason: 'Choose a reason.',
  },
  ar: {
    title: 'روشتة',
    description: '<p>ارفع صورة واضحة للروشتة وسيتصل بك الصيدلي.</p>',
    type: 'نوع الروشتة', number: 'رقم الروشتة', numberHint: 'مطلوب لروشتات وصفتي.',
    files: 'صور الروشتة', filesHint: 'صور أو ملف PDF للروشتة، حتى 10 ملفات.', note: 'ملاحظات للصيدلي',
    kinds: { cash: 'كاش', wasfaty: 'وصفتي', insurance: 'تأمين' },
    insuranceProfile: 'بيانات التأمين', insuranceProfileHint: 'أضف بيانات تأمينك في صفحة التأمين أولاً.', preApproved: 'الموافقة',
    preApprovedNo: 'طلب جديد', preApprovedYes: 'تمت الموافقة من شركة التأمين', approvalNumber: 'رقم الموافقة', invoiceFiles: 'صور الفاتورة',
    chooseProfile: 'اختر أحد بيانات التأمين الخاصة بك.',
    status: { received: 'تم الاستلام', in_progress: 'جاري التجهيز', delivered: 'تم التوصيل', cancelled: 'ملغاة' },
    blockers: {
      add_address: 'أضف عنوان التوصيل أولاً ثم أرسل الروشتة.',
      add_phone: 'أضف رقم هاتفك إلى ملفك الشخصي ليتمكن الصيدلي من الاتصال بك.',
      verify_phone: 'وثّق رقم هاتفك ليتمكن الصيدلي من الاتصال بك.',
    },
    sent: 'شكراً لك! استلمنا الروشتة وسنتواصل معك قريباً.',
    reasons: ['اشتريتها من مكان آخر', 'غيرت رأيي'],
    errors: {
      validation_failed: 'يرجى مراجعة الحقول المحددة.', not_found: 'غير موجود.', unauthenticated: 'يرجى تسجيل الدخول أولاً.',
      cannot_cancel: 'لم يعد من الممكن إلغاء هذه الروشتة.',
    },
    required: (label) => `${label} مطلوب.`, address: 'اختر أحد عناوينك.', choose: 'اختر أحد الخيارات.',
    filesAgain: 'يرجى رفع الملفات مرة أخرى.', reason: 'اختر سبباً.',
  },
};

const REASON_IDS = [3, 4];
const fresh = () => ({ enabled: true, wasfaty: false, numberMode: false, phone: 'ok' });

export function createPrescriptionsModule(shopper) {
  let mode = fresh();
  let nextId = 1043;

  const error = (status, code, locale, extra = {}) => [status, { error: { code, message: TEXT[locale].errors[code] ?? code, ...extra } }];
  const insurance = insuranceState(shopper);
  const kinds = () => ['cash', ...(mode.wasfaty ? ['wasfaty'] : []), ...(insurance.on ? ['insurance'] : [])];
  const numberRequired = (kind, preApproved = false) => kind === 'wasfaty' || (!(kind === 'insurance' && preApproved) && mode.numberMode);

  /** Raw rows of a session: {id, status, kind, placedAt, note, number, fileCount, addressId, cancellation}. */
  function rowsOf(session) {
    if (!session.prescriptions) {
      const seeded = session === shopper.session('test-customer');
      session.prescriptions = seeded
        ? [
            { id: 1042, status: 'received', kind: 'cash', placedAt: '2026-09-28T09:30:00+03:00', note: 'Morning, please', number: null, fileCount: 2, cancellation: null },
            { id: 1041, status: 'in_progress', kind: 'cash', placedAt: '2026-09-20T18:10:00+03:00', note: null, number: null, fileCount: 1, cancellation: null },
          ]
        : [];
    }
    return session.prescriptions;
  }

  function present(row, session, locale) {
    const t = TEXT[locale];
    const address = addressesOf(session, locale)[0]?.formatted ?? null;
    return {
      id: String(row.id),
      reference: `#${row.id}`,
      status: { code: row.status, label: t.status[row.status] },
      placedAt: row.placedAt,
      type: kinds().length > 1 ? t.kinds[row.kind] : null,
      prescriptionNumber: row.number,
      note: row.note,
      fileCount: row.fileCount,
      address,
      cancellation: row.cancellation ? { reason: t.reasons[REASON_IDS.indexOf(row.cancellation.reasonId)], note: row.cancellation.note } : null,
      actions: { canCancel: row.status === 'received' },
    };
  }

  function blockers(session, locale) {
    const t = TEXT[locale].blockers;
    const list = [];
    if (mode.phone === 'missing') list.push({ code: 'add_phone', message: t.add_phone });
    if (mode.phone === 'unverified') list.push({ code: 'verify_phone', message: t.verify_phone });
    if (addressesOf(session, locale).length === 0) list.push({ code: 'add_address', message: t.add_address });
    return list;
  }

  function field(name, label, kind, required, extra = {}) {
    return { name, label, kind, required, placeholder: null, options: [], multiple: false, hint: null, maxLength: null, ...extra };
  }

  function form(session, locale) {
    const t = TEXT[locale];
    const offered = kinds();
    const fields = [];
    if (offered.length > 1) fields.push(field('type', t.type, 'select', true, { options: offered.map((kind, i) => ({ value: kind, label: t.kinds[kind], selected: i === 0 })) }));
    // phase B: the insurance kind, its fields shown only for it (approval number only when pre-approved)
    const isInsurance = [{ field: 'type', values: ['insurance'] }];
    if (offered.includes('insurance')) {
      const profiles = insurance.rows(session).map((row, i) => ({ value: String(row.id), label: insurance.present(row, locale).label, selected: i === 0 }));
      fields.push(field('insuranceProfileId', t.insuranceProfile, 'select', true, { options: profiles, hint: profiles.length ? null : t.insuranceProfileHint, showWhen: isInsurance }));
      fields.push(field('preApproved', t.preApproved, 'select', true, { options: [{ value: 'no', label: t.preApprovedNo, selected: true }, { value: 'yes', label: t.preApprovedYes, selected: false }], showWhen: isInsurance }));
      fields.push(field('approvalNumber', t.approvalNumber, 'text', true, { maxLength: 100, showWhen: [...isInsurance, { field: 'preApproved', values: ['yes'] }] }));
    }
    fields.push(field('prescriptionNumber', t.number, 'text', numberRequired(offered[0]), { hint: mode.wasfaty && !mode.numberMode ? t.numberHint : null, maxLength: 100 }));
    fields.push(field('files', t.files, 'file', !numberRequired(offered[0]), { hint: t.filesHint, multiple: true }));
    if (offered.includes('insurance')) fields.push(field('invoiceFiles', t.invoiceFiles, 'file', false, { multiple: true, showWhen: isInsurance }));
    fields.push(field('note', t.note, 'textarea', false, { maxLength: 1000 }));
    const list = blockers(session, locale);
    return {
      title: t.title,
      description: { html: t.description },
      video: null,
      fields,
      addresses: addressesOf(session, locale).map((address, i) => ({ id: address.id, label: address.formatted, selected: i === 0 })),
      blockers: list,
      canSend: list.length === 0,
    };
  }

  function send(session, locale, body) {
    const t = TEXT[locale];
    const offered = kinds();
    const values = body && typeof body === 'object' ? body : {};
    const kind = offered.length > 1 ? String(values.type ?? '') : offered[0];
    const fields = {};
    if (!offered.includes(kind)) fields.type = [t.choose];
    const files = Array.isArray(values.files) ? values.files : [];
    const number = typeof values.prescriptionNumber === 'string' ? values.prescriptionNumber.trim() : '';
    const preApproved = kind === 'insurance' && values.preApproved === 'yes';
    if (offered.includes(kind) && numberRequired(kind, preApproved) && !number) fields.prescriptionNumber = [t.required(t.number)];
    if (offered.includes(kind) && !numberRequired(kind, preApproved) && !preApproved && files.length === 0) fields.files = [t.required(t.files)];
    if (kind === 'insurance' && offered.includes(kind)) {
      if (!insurance.rows(session).some((row) => String(row.id) === String(values.insuranceProfileId))) fields.insuranceProfileId = [t.chooseProfile];
      if (preApproved && !(typeof values.approvalNumber === 'string' && values.approvalNumber.trim())) fields.approvalNumber = [t.required(t.approvalNumber)];
    }
    if (files.length > 10 || files.some((id) => typeof id !== 'string' || !session.uploads?.has(id))) fields.files = [t.filesAgain];
    if (!addressesOf(session, locale).some((address) => address.id === values.addressId)) fields.addressId = [t.address];
    if (Object.keys(fields).length) return error(422, 'validation_failed', locale, { fields });
    const list = blockers(session, locale);
    if (list.length) return [409, { error: { code: 'prescription_blocked', message: list[0].message } }];

    const note = typeof values.note === 'string' && values.note.trim() ? values.note.trim() : null;
    const row = { id: nextId++, status: 'received', kind, placedAt: '2026-09-29T10:00:00+03:00', note, number: number || null, fileCount: files.length, cancellation: null };
    rowsOf(session).unshift(row);
    return [201, { data: { prescription: present(row, session, locale), message: t.sent } }];
  }

  function cancel(session, locale, id, body) {
    const row = rowsOf(session).find((entry) => String(entry.id) === id);
    if (!row) return error(404, 'not_found', locale);
    const reasonId = body?.reasonId;
    if (!REASON_IDS.includes(reasonId)) return error(422, 'validation_failed', locale, { fields: { reasonId: [TEXT[locale].reason] } });
    if (row.status !== 'received') return error(409, 'cannot_cancel', locale);
    row.status = 'cancelled';
    row.cancellation = { reasonId, note: typeof body?.note === 'string' && body.note.trim() ? body.note.trim() : null };
    return [200, { data: present(row, session, locale) }];
  }

  return {
    handle({ method, pathname, token, locale, body, query }) {
      if (pathname !== '/prescriptions' && !pathname.startsWith('/prescriptions/')) return null;
      const session = shopper.session(token);
      if (!session || session.isGuest) return error(401, 'unauthenticated', locale);
      if (!mode.enabled) return error(404, 'not_found', locale);

      if (method === 'GET' && pathname === '/prescriptions/form') return [200, { data: form(session, locale) }];
      if (method === 'GET' && pathname === '/prescriptions/cancellation-reasons') {
        return [200, { data: { items: REASON_IDS.map((id, i) => ({ id, text: TEXT[locale].reasons[i] })) } }];
      }
      if (method === 'GET' && pathname === '/prescriptions') {
        const perPage = Math.min(50, Math.max(1, Number(query.get('perPage') ?? 10) || 10));
        const page = Math.max(1, Number(query.get('page') ?? 1) || 1);
        const rows = rowsOf(session);
        return [200, { data: { items: rows.slice((page - 1) * perPage, page * perPage).map((row) => present(row, session, locale)), pagination: { page, perPage, total: rows.length, totalPages: Math.ceil(rows.length / perPage) } } }];
      }
      if (method === 'POST' && pathname === '/prescriptions') return send(session, locale, body);
      const cancelled = pathname.match(/^\/prescriptions\/([^/]+)\/cancel$/);
      if (method === 'POST' && cancelled) return cancel(session, locale, decodeURIComponent(cancelled[1]), body);
      return error(404, 'not_found', locale);
    },
    /** POST /__mode {"prescriptions": {...}} */
    mode(body) {
      if (body && typeof body.prescriptions === 'object' && body.prescriptions) mode = { ...mode, ...body.prescriptions };
      return { prescriptions: { ...mode } };
    },
    /** The layout's switch follows the mock's. */
    decorate(endpoint, data) {
      return endpoint === 'layout' ? { ...data, features: { ...data.features, prescriptions: mode.enabled } } : data;
    },
    reset() {
      mode = fresh();
      nextId = 1043;
    },
  };
}
