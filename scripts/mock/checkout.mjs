/**
 * Mock module: checkout, placing the order and its result (contract: "Checkout" in the description).
 *   POST /checkout          → CheckoutResponse (never writes)
 *   POST /orders            → PlaceOrderResponse | 409/403/422/502 ErrorResponse (with `checkout` when the contract says so)
 *   GET  /checkout/result   → CheckoutResultResponse
 *   PUT  /checkout/contact  → { data: CheckoutContact }
 *   GET  /pickup-branches   → PickupBranchesResponse
 *   POST /uploads           → { data: UploadedFile }
 * Not in the contract (test scaffolding):
 *   GET  /__pay?ref=                 → the mock bank's payment page (HTML)
 *   GET  /__pay/finish?ref=&outcome= → records paid | failed | cancelled | pending | stuck, then sends the
 *                                       browser back to the order's `returnUrl` with `?checkout=<reference>`
 *   POST /__checkout {…}             → control switches (see `freshMode()`); GET /__checkout → switches, the order requests
 *                                       received and (with a token) that shopper's order numbers
 *
 * The cart and the shopper come from the shopper store, the address book and the orders from
 * account-state.mjs. The rules here are only good enough to reach every state of the checkout
 * page: the real ones live in the backend.
 *
 * What the mock store does:
 * - first call (no choices): delivery + the default address are preselected when that address is deliverable
 * - delivery costs 25–40 EGP by area; pickup is free ("Free" text instead of an amount)
 * - an address in the area the store does not serve is dropped with a message
 * - payment: cash (offline), card on delivery (offline, 10 EGP fee), card online (redirect to /__pay),
 *   installments (online, the shopper must pick a plan)
 * - promo codes: SAVE10 (10% off), FREEDEL (free delivery), anything else → message + `promo_invalid` blocker
 * - product 14482 needs a prescription at checkout (upload a file first)
 * - guests need contact details; phone 01000000001 belongs to an account (`phone_in_use`)
 */
import { addressRows, addressesOf, newOrderIdentity, orderRows, resetAccountCounters } from './account-state.mjs';
import { priceWithText } from './shopper.mjs';

export const PRESCRIPTION_PRODUCT_ID = 14482;
export const PAYMENT = { cash: 1, cardOnDelivery: 2, cardOnline: 3, installments: 4 };
export const PROMO = { percent: 'SAVE10', freeDelivery: 'FREEDEL' };
export const PHONE_IN_USE = '01000000001';
const PLACED_AT = '2026-09-29T10:00:00.000Z';
const CURRENCY = 'EGP';
const DELIVERY_FEES = { 11: 25, 12: 35, 21: 40 };
const CARD_ON_DELIVERY_FEE = 10;
const UPLOAD_TYPES = /\.(jpe?g|png|webp|pdf)$/i;

const BRANCHES = [
  { id: 71, name: { en: 'Nasr City branch', ar: 'فرع مدينة نصر' }, address: { en: '45 Makram Ebeid St, Nasr City, Cairo', ar: '45 شارع مكرم عبيد، مدينة نصر، القاهرة' }, phone: '0221234567', mapUrl: 'https://maps.example.com/?q=nasr-city-branch' },
  { id: 72, name: { en: 'Dokki branch', ar: 'فرع الدقي' }, address: { en: '8 Tahrir St, Dokki, Giza', ar: '8 شارع التحرير، الدقي، الجيزة' }, phone: null, mapUrl: null },
];

const METHODS = [
  { id: PAYMENT.cash, name: { en: 'Cash on delivery', ar: 'الدفع عند الاستلام' }, online: false, fee: null, note: { en: null, ar: null }, plans: [] },
  { id: PAYMENT.cardOnDelivery, name: { en: 'Card on delivery', ar: 'بطاقة عند الاستلام' }, online: false, fee: CARD_ON_DELIVERY_FEE, note: { en: 'The courier brings a card machine.', ar: 'يحضر المندوب ماكينة الدفع.' }, plans: [] },
  { id: PAYMENT.cardOnline, name: { en: 'Credit / debit card', ar: 'بطاقة ائتمان / خصم' }, online: true, fee: null, note: { en: null, ar: null }, plans: [] },
  {
    id: PAYMENT.installments,
    name: { en: 'Installments', ar: 'التقسيط' },
    online: true,
    fee: null,
    note: { en: 'Pay in monthly installments.', ar: 'ادفع على أقساط شهرية.' },
    plans: [
      { id: 41, name: { en: '6 months', ar: '6 أشهر' } },
      { id: 42, name: { en: '12 months', ar: '12 شهراً' } },
    ],
  },
];

const TEXT = {
  en: {
    unauthenticated: 'Please start a session first.',
    not_found: 'Not found.',
    delivery: 'Delivery',
    pickup: 'Click & Collect',
    pickupClosed: 'Pickup is not available right now.',
    fulfilmentDropped: 'Pickup is not available right now. Choose another way to get your order.',
    addressGone: 'The address you chose no longer exists. Choose another address.',
    addressNotDeliverable: (address) => `We do not deliver to ${address} right now. Choose another address.`,
    branchGone: 'The branch you chose is not available. Choose another branch.',
    paymentDropped: 'The payment method you chose is not available any more. Choose another one.',
    paymentChanged: (from, to) => `${from} is not available right now. Your order will be paid with ${to} instead.`,
    free: 'Free',
    pickupFree: 'Free — collect it from the branch',
    promoPercent: '10% off your items.',
    promoFreeDelivery: 'Free delivery applied.',
    promoInvalid: 'This promo code is not valid.',
    subtotal: 'Subtotal',
    promoLine: (code) => `Promo code ${code}`,
    paymentFee: (name) => `${name} fee`,
    missing: {
      sign_in: 'Sign in to place your order.',
      contact: 'Add your contact details.',
      fulfilment: 'Choose delivery or pickup.',
      address: 'Choose a delivery address.',
      branch: 'Choose a pickup branch.',
      payment_method: 'Choose a payment method.',
      installment_plan: 'Choose an installment plan.',
      prescription: 'Upload your prescription.',
    },
    guest_checkout_disabled: 'This store needs an account to place an order.',
    promo_invalid: 'Remove the promo code or enter a valid one.',
    total_changed: (total) => `Your order total changed to ${total}. Please review it and confirm again.`,
    checkout_incomplete: 'Your order is not ready to be placed yet. Please review it.',
    payment_change_needs_consent: 'The payment method of your order changed. Please accept the change to continue.',
    order_in_progress: 'We are already placing an order for you. Please wait a moment.',
    payment_provider_error: 'The payment provider did not answer. Please try again or choose another payment method.',
    phone_in_use: 'This phone number belongs to an account. Sign in to continue.',
    validation_failed: 'Please check the highlighted fields.',
    required: 'This field is required.',
    phoneInvalid: 'Enter a valid phone number.',
    emailInvalid: 'Enter a valid email address.',
    termsRequired: 'Accept the terms to place your order.',
    returnUrlRequired: 'A return URL is needed for online payments.',
    fileRequired: 'Choose a file to upload.',
    fileType: 'Upload a jpg, png, webp or pdf file.',
    resultPlaced: 'Thank you! We received your order.',
    resultPaid: 'Thank you! Your payment was received and your order is placed.',
    resultPending: 'We are waiting for the bank to confirm your payment.',
    resultFailed: 'The payment was declined. You were not charged.',
    resultCancelled: 'You cancelled the payment. Your cart is still here.',
    statusProcessing: 'Processing',
    timeline: ['Order placed', 'Processing', 'On its way', 'Delivered'],
  },
  ar: {
    unauthenticated: 'يرجى بدء جلسة أولاً.',
    not_found: 'غير موجود.',
    delivery: 'التوصيل',
    pickup: 'استلم من الفرع',
    pickupClosed: 'الاستلام من الفرع غير متاح حالياً.',
    fulfilmentDropped: 'الاستلام من الفرع غير متاح حالياً. اختر طريقة أخرى لاستلام طلبك.',
    addressGone: 'العنوان الذي اخترته لم يعد موجوداً. اختر عنواناً آخر.',
    addressNotDeliverable: (address) => `لا نوصل إلى ${address} حالياً. اختر عنواناً آخر.`,
    branchGone: 'الفرع الذي اخترته غير متاح. اختر فرعاً آخر.',
    paymentDropped: 'طريقة الدفع التي اخترتها لم تعد متاحة. اختر طريقة أخرى.',
    paymentChanged: (from, to) => `${from} غير متاحة حالياً. سيتم دفع طلبك عن طريق ${to}.`,
    free: 'مجاناً',
    pickupFree: 'مجاناً — استلمه من الفرع',
    promoPercent: 'خصم 10% على منتجاتك.',
    promoFreeDelivery: 'تم تطبيق التوصيل المجاني.',
    promoInvalid: 'كود الخصم غير صالح.',
    subtotal: 'المجموع الفرعي',
    promoLine: (code) => `كود الخصم ${code}`,
    paymentFee: (name) => `رسوم ${name}`,
    missing: {
      sign_in: 'سجّل الدخول لإتمام طلبك.',
      contact: 'أضف بيانات التواصل.',
      fulfilment: 'اختر التوصيل أو الاستلام من الفرع.',
      address: 'اختر عنوان التوصيل.',
      branch: 'اختر فرع الاستلام.',
      payment_method: 'اختر طريقة الدفع.',
      installment_plan: 'اختر خطة التقسيط.',
      prescription: 'ارفع الروشتة.',
    },
    guest_checkout_disabled: 'يتطلب هذا المتجر حساباً لإتمام الطلب.',
    promo_invalid: 'احذف كود الخصم أو أدخل كوداً صالحاً.',
    total_changed: (total) => `تغيّر إجمالي طلبك إلى ${total}. يرجى مراجعته والتأكيد مرة أخرى.`,
    checkout_incomplete: 'طلبك غير جاهز للإتمام بعد. يرجى مراجعته.',
    payment_change_needs_consent: 'تغيّرت طريقة دفع طلبك. يرجى الموافقة على التغيير للمتابعة.',
    order_in_progress: 'نقوم بإتمام طلب لك بالفعل. يرجى الانتظار لحظة.',
    payment_provider_error: 'لم يستجب مزوّد الدفع. حاول مرة أخرى أو اختر طريقة دفع أخرى.',
    phone_in_use: 'رقم الهاتف هذا مرتبط بحساب. سجّل الدخول للمتابعة.',
    validation_failed: 'يرجى مراجعة الحقول المحددة.',
    required: 'هذا الحقل مطلوب.',
    phoneInvalid: 'أدخل رقم هاتف صحيحاً.',
    emailInvalid: 'أدخل بريداً إلكترونياً صحيحاً.',
    termsRequired: 'وافق على الشروط لإتمام طلبك.',
    returnUrlRequired: 'مطلوب رابط العودة للدفع الإلكتروني.',
    fileRequired: 'اختر ملفاً لرفعه.',
    fileType: 'ارفع ملف jpg أو png أو webp أو pdf.',
    resultPlaced: 'شكراً لك! استلمنا طلبك.',
    resultPaid: 'شكراً لك! تم استلام الدفع وتأكيد طلبك.',
    resultPending: 'ننتظر تأكيد البنك لعملية الدفع.',
    resultFailed: 'تم رفض عملية الدفع. لم يتم خصم أي مبلغ.',
    resultCancelled: 'ألغيت عملية الدفع. سلتك ما زالت كما هي.',
    statusProcessing: 'قيد التجهيز',
    timeline: ['تم استلام الطلب', 'قيد التجهيز', 'في الطريق', 'تم التوصيل'],
  },
};

const CUSTOMER_CONTACT = { isGuest: false, name: 'Test Customer', phone: PHONE_IN_USE, email: 'test.customer@example.com' };

/** The control switches (POST /__checkout). */
function freshMode() {
  return {
    /** False → guests get `missing: sign_in` and the `guest_checkout_disabled` blocker / error. */
    guestCheckout: true,
    /** False → the pickup option is shown as not available, with a reason. */
    pickup: true,
    /** True → the online card method is not offered any more (placing with it asks for consent to pay cash). */
    cardDown: false,
    /** 'order_in_progress' | 'payment_provider_error' → the next POST /orders answers that error, once. */
    nextOrderError: null,
  };
}

const round2 = (amount) => Math.round(amount * 100) / 100;
const isId = (value) => Number.isInteger(value) && value > 0;

export function createCheckoutModule(shopper, { now = () => Date.now(), pendingMs = 4000 } = {}) {
  let mode = freshMode();
  let referenceCounter = 0;
  let uploadCounter = 0;
  /** reference → { token, kind: 'order', orderId } | { token, kind: 'payment', status, selections, note, returnUrl, totalText, settleAt, orderId } */
  const references = new Map();
  /** `${token} ${Idempotency-Key}` → the first successful answer */
  const answered = new Map();
  /** productId → { en, ar } original prices, for reset() */
  const originalPrices = new Map();
  /** What POST /orders received (for tests: what did the storefront really send?). */
  const orderRequests = [];

  const total = (amount, locale) => shopper.total(amount, locale);
  const negative = (amount, locale) => {
    const positive = total(amount, locale);
    return { amount: -positive.amount, currency: CURRENCY, display: `-${positive.display}` };
  };
  const notice = (code, message) => ({ code, message });
  const error = (status, code, locale, extra = {}, message = TEXT[locale][code]) => [status, { error: { code, message, ...extra.error }, ...(extra.checkout ? { checkout: extra.checkout } : {}) }];

  function setPrice(productId, amount) {
    for (const locale of ['en', 'ar']) {
      const card = shopper.product(productId, locale);
      if (!card) return false;
      if (!originalPrices.has(productId)) originalPrices.set(productId, {});
      originalPrices.get(productId)[locale] ??= card.price;
      card.price = priceWithText({ amount }, locale);
    }
    return true;
  }

  function restorePrices() {
    for (const [productId, prices] of originalPrices) {
      for (const locale of ['en', 'ar']) {
        const card = shopper.product(productId, locale);
        if (card && prices[locale] !== undefined) card.price = prices[locale];
      }
    }
    originalPrices.clear();
  }

  /** The cart as checkout sees it: the mock store wants a prescription for one product. */
  function checkoutCart(session, locale) {
    const cart = shopper.cartOf(session, locale);
    if (!cart.items.some((item) => item.product.id === PRESCRIPTION_PRODUCT_ID)) return cart;
    return {
      ...cart,
      items: cart.items.map((item) => (item.product.id === PRESCRIPTION_PRODUCT_ID ? { ...item, product: { ...item.product, requiresPrescription: true } } : item)),
      requiresPrescription: true,
    };
  }

  const offeredMethods = () => METHODS.filter((method) => !(mode.cardDown && method.id === PAYMENT.cardOnline));
  const branch = (row, locale) => ({ id: row.id, name: row.name[locale], address: row.address[locale], phone: row.phone, mapUrl: row.mapUrl });

  /** The checkout for these choices, as the contract's `Checkout`. Never changes anything. */
  function compute(session, locale, selections) {
    const t = TEXT[locale];
    const sel = selections && typeof selections === 'object' ? selections : {};
    const messages = [];
    const missing = [];
    const blockers = [];
    const cart = checkoutCart(session, locale);
    const subtotal = cart.summary.total.amount;

    // who is ordering
    let contact = CUSTOMER_CONTACT;
    if (session.isGuest) {
      const saved = session.checkoutContact ?? null;
      contact = { isGuest: true, name: saved ? `${saved.firstName} ${saved.lastName}` : null, phone: saved?.phone ?? null, email: saved?.email ?? null };
      if (!mode.guestCheckout) {
        missing.push(notice('sign_in', t.missing.sign_in));
        blockers.push(notice('guest_checkout_disabled', t.guest_checkout_disabled));
      } else if (!saved) missing.push(notice('contact', t.missing.contact));
    }

    // how the order gets to the shopper
    const addresses = addressesOf(session, locale);
    const options = [
      { type: 'delivery', label: t.delivery, available: true, reason: null },
      { type: 'pickup', label: t.pickup, available: mode.pickup, reason: mode.pickup ? null : t.pickupClosed },
    ];
    let selected = sel.fulfilment === 'delivery' || sel.fulfilment === 'pickup' ? sel.fulfilment : null;
    if (selected && !options.find((option) => option.type === selected)?.available) {
      messages.push({ level: 'warning', text: t.fulfilmentDropped });
      selected = null;
    } else if (!selected && sel.fulfilment == null && addresses.some((address) => address.isDefault && address.deliverable)) {
      selected = 'delivery'; // the backend may preselect
    }
    if (!selected) missing.push(notice('fulfilment', t.missing.fulfilment));

    let address = null;
    let pickupBranch = null;
    let delivery = null;
    let deliveryFee = 0;
    if (selected === 'delivery') {
      if (sel.addressId != null) {
        const chosen = addresses.find((item) => item.id === sel.addressId);
        if (!chosen) messages.push({ level: 'warning', text: t.addressGone });
        else if (!chosen.deliverable) messages.push({ level: 'warning', text: t.addressNotDeliverable(chosen.formatted) });
        else address = chosen;
      } else {
        address = addresses.find((item) => item.isDefault && item.deliverable) ?? null;
      }
      if (!address) missing.push(notice('address', t.missing.address));
    }
    if (selected === 'pickup') {
      if (sel.branchId != null) {
        const row = BRANCHES.find((item) => item.id === sel.branchId);
        if (row) pickupBranch = branch(row, locale);
        else messages.push({ level: 'warning', text: t.branchGone });
      }
      if (!pickupBranch) missing.push(notice('branch', t.missing.branch));
    }

    // promo code
    const code = typeof sel.promoCode === 'string' && sel.promoCode.trim() ? sel.promoCode.trim() : null;
    const promo = { code, applied: false, message: null };
    let discount = 0;
    let freeDelivery = false;
    if (code) {
      if (code.toUpperCase() === PROMO.percent) {
        promo.applied = true;
        promo.message = t.promoPercent;
        discount = round2(subtotal * 0.1);
      } else if (code.toUpperCase() === PROMO.freeDelivery) {
        promo.applied = true;
        promo.message = t.promoFreeDelivery;
        freeDelivery = true;
      } else {
        promo.message = t.promoInvalid;
        blockers.push(notice('promo_invalid', t.promo_invalid));
      }
    }

    if (address) {
      deliveryFee = freeDelivery ? 0 : (DELIVERY_FEES[address.area?.id] ?? 30);
      delivery = freeDelivery ? { fee: null, text: t.free, free: true } : { fee: total(deliveryFee, locale), text: null, free: false };
    } else if (pickupBranch) {
      delivery = { fee: null, text: t.pickupFree, free: true };
    }

    // payment
    const methods = offeredMethods().map((method) => ({
      id: method.id,
      name: method.name[locale],
      icon: null,
      online: method.online,
      fee: method.fee === null ? null : total(method.fee, locale),
      note: method.note[locale],
      plans: method.plans.map((plan) => ({ id: plan.id, name: plan.name[locale] })),
    }));
    let payment = null;
    if (sel.paymentMethodId != null) {
      const method = methods.find((item) => item.id === sel.paymentMethodId);
      if (!method) messages.push({ level: 'warning', text: t.paymentDropped });
      else payment = { methodId: method.id, planId: method.plans.some((plan) => plan.id === sel.installmentPlanId) ? sel.installmentPlanId : null };
    }
    const method = payment ? METHODS.find((item) => item.id === payment.methodId) : null;
    if (!payment) missing.push(notice('payment_method', t.missing.payment_method));
    else if (method.plans.length && payment.planId === null) missing.push(notice('installment_plan', t.missing.installment_plan));
    const paymentFee = method?.fee ?? 0;

    // prescription
    const uploads = session.uploads ?? new Map();
    const required = cart.requiresPrescription;
    const files = required && Array.isArray(sel.prescriptionFiles) ? sel.prescriptionFiles.filter((id) => uploads.has(id)).map((id) => ({ id, name: uploads.get(id) })) : [];
    if (required && !files.length) missing.push(notice('prescription', t.missing.prescription));

    // the price breakdown
    const lines = [{ kind: 'subtotal', label: t.subtotal, amount: total(subtotal, locale), text: null }];
    if (discount) lines.push({ kind: 'promo_code', label: t.promoLine(code), amount: negative(discount, locale), text: null });
    if (delivery) lines.push({ kind: 'delivery', label: t.delivery, amount: delivery.fee, text: delivery.text });
    if (paymentFee) lines.push({ kind: 'payment_fee', label: t.paymentFee(method.name[locale]), amount: total(paymentFee, locale), text: null });

    blockers.unshift(...cart.checkout.blockers.map((blocker) => notice(blocker.code, blocker.message)));

    return {
      cart,
      contact,
      fulfilment: { options, selected, addresses, addressId: address?.id ?? null, branch: pickupBranch, delivery },
      payment: { methods, selected: payment },
      promo,
      requirements: { prescription: { required, files } },
      totals: { lines, total: total(subtotal - discount + deliveryFee + paymentFee, locale) },
      minimumOrder: cart.checkout.minimumOrder,
      missing,
      blockers,
      messages,
      canPlaceOrder: missing.length === 0 && blockers.length === 0,
    };
  }

  function buildOrder(identity, checkout, locale, note) {
    const t = TEXT[locale];
    const method = checkout.payment.methods.find((item) => item.id === checkout.payment.selected?.methodId) ?? null;
    const address = checkout.fulfilment.addresses.find((item) => item.id === checkout.fulfilment.addressId) ?? null;
    return {
      id: identity.id,
      number: identity.number,
      placedAt: PLACED_AT,
      status: { code: 'processing', label: t.statusProcessing, active: true },
      timeline: t.timeline.map((label, index) => ({ label, done: index === 0, current: index === 1 })),
      fulfilment: { type: checkout.fulfilment.selected ?? 'delivery', address: address?.formatted ?? null, branch: checkout.fulfilment.branch },
      payment: { method: method?.name ?? null, online: method?.online ?? false },
      items: checkout.cart.items.map((item) => ({
        name: item.product.name,
        image: item.product.image,
        target: item.product.target,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
        compareAt: null,
      })),
      totals: checkout.totals,
      note: note ?? null,
      actions: { canCancel: true, canReorder: true },
    };
  }

  /** Creates the order from the cart (both languages), empties the cart, returns the order id. */
  function createOrder(session, selections, note) {
    const identity = newOrderIdentity();
    const order = Object.fromEntries(['en', 'ar'].map((locale) => [locale, buildOrder(identity, compute(session, locale, selections), locale, note)]));
    orderRows(session).unshift(order);
    session.cart.clear();
    delete session.consentForMethod;
    return identity.id;
  }

  const orderOf = (session, orderId, locale) => orderRows(session).find((row) => row.en.id === orderId)?.[locale] ?? null;

  /** The bank answers late: a pending payment becomes a paid order once its time has come. */
  function settle() {
    for (const entry of references.values()) {
      if (entry.kind !== 'payment' || entry.status !== 'pending' || entry.settleAt === null || entry.settleAt > now()) continue;
      const session = shopper.session(entry.token);
      if (!session) continue;
      entry.orderId = createOrder(session, entry.selections, entry.note);
      entry.status = 'paid';
    }
  }

  function placeOrder({ session, token, locale, body, headers }) {
    const t = TEXT[locale];
    const request = body && typeof body === 'object' ? body : {};
    const key = typeof headers?.['idempotency-key'] === 'string' && headers['idempotency-key'] ? `${token} ${headers['idempotency-key']}` : null;
    orderRequests.push({ idempotencyKey: headers?.['idempotency-key'] ?? null, body: request });
    if (key && answered.has(key)) return answered.get(key);

    const fields = {};
    if (request.acceptTerms !== true) fields.acceptTerms = [t.termsRequired];
    if (typeof request.expectedTotal !== 'number' || !Number.isFinite(request.expectedTotal)) fields.expectedTotal = [t.required];
    if (Object.keys(fields).length) return error(422, 'validation_failed', locale, { error: { fields } });

    if (mode.nextOrderError) {
      const code = mode.nextOrderError;
      mode.nextOrderError = null;
      return error(code === 'payment_provider_error' ? 502 : 409, code, locale);
    }
    if (session.isGuest && !mode.guestCheckout) return error(403, 'guest_checkout_disabled', locale);

    const selections = request.selections && typeof request.selections === 'object' ? request.selections : {};

    // The chosen payment method is gone and the store would switch to cash: the shopper must accept that first.
    const wanted = METHODS.find((method) => method.id === selections.paymentMethodId);
    const offered = offeredMethods();
    if (wanted && !offered.includes(wanted)) {
      const fallback = offered[0];
      session.consentForMethod = fallback.id;
      const checkout = compute(session, locale, { ...selections, paymentMethodId: fallback.id, installmentPlanId: null });
      checkout.messages.push({ level: 'warning', text: t.paymentChanged(wanted.name[locale], fallback.name[locale]) });
      return error(409, 'payment_change_needs_consent', locale, { checkout });
    }
    if (session.consentForMethod !== undefined && selections.paymentMethodId === session.consentForMethod && selections.acceptPaymentChange !== true) {
      return error(409, 'payment_change_needs_consent', locale, { checkout: compute(session, locale, selections) });
    }

    const checkout = compute(session, locale, selections);
    if (!checkout.canPlaceOrder) return error(409, 'checkout_incomplete', locale, { checkout });
    if (round2(request.expectedTotal) !== checkout.totals.total.amount) {
      return error(409, 'total_changed', locale, { checkout }, t.total_changed(checkout.totals.total.display));
    }

    const note = typeof selections.note === 'string' && selections.note.trim() ? selections.note.trim() : null;
    const method = METHODS.find((item) => item.id === checkout.payment.selected.methodId);
    const reference = `mock-checkout-${++referenceCounter}`;
    let answer;
    if (method.online) {
      if (typeof request.returnUrl !== 'string' || !/^https?:\/\//i.test(request.returnUrl)) {
        return error(422, 'validation_failed', locale, { error: { fields: { returnUrl: [t.returnUrlRequired] } } });
      }
      references.set(reference, { token, kind: 'payment', status: 'started', selections, note, returnUrl: request.returnUrl, totalText: checkout.totals.total.display, settleAt: null, orderId: null });
      const origin = `http://${headers?.host ?? '127.0.0.1'}`;
      answer = [200, { data: { next: { type: 'redirect', url: `${origin}/api/customer/v3/__pay?ref=${encodeURIComponent(reference)}`, reference }, order: null } }];
    } else {
      const orderId = createOrder(session, selections, note);
      references.set(reference, { token, kind: 'order', orderId });
      answer = [200, { data: { next: { type: 'done', url: null, reference }, order: orderOf(session, orderId, locale) } }];
    }
    if (key) answered.set(key, answer);
    return answer;
  }

  function result({ session, token, locale, query }) {
    const t = TEXT[locale];
    const entry = references.get(query.get('ref') ?? '');
    if (!entry || entry.token !== token) return error(404, 'not_found', locale);
    const answer = (status, message, order = null, retry = false) => [200, { data: { status, message, order, retry } }];
    if (entry.kind === 'order') return answer('placed', t.resultPlaced, orderOf(session, entry.orderId, locale));
    switch (entry.status) {
      case 'paid':
        return answer('paid', t.resultPaid, orderOf(session, entry.orderId, locale));
      case 'failed':
        return answer('failed', t.resultFailed, null, true);
      case 'cancelled':
        return answer('cancelled', t.resultCancelled, null, true);
      default:
        return answer('pending', t.resultPending);
    }
  }

  function saveContact({ session, locale, body }) {
    const t = TEXT[locale];
    if (!session.isGuest) return [200, { data: CUSTOMER_CONTACT }];
    if (!mode.guestCheckout) return error(403, 'guest_checkout_disabled', locale);
    const text = (value) => (typeof value === 'string' ? value.trim() : '');
    const input = { firstName: text(body?.firstName), lastName: text(body?.lastName), phone: text(body?.phone), email: text(body?.email) || null };
    const fields = {};
    if (!input.firstName) fields.firstName = [t.required];
    if (!input.lastName) fields.lastName = [t.required];
    if (!/^\+?\d{5,20}$/.test(input.phone)) fields.phone = [input.phone ? t.phoneInvalid : t.required];
    if (input.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) fields.email = [t.emailInvalid];
    if (Object.keys(fields).length) return error(422, 'validation_failed', locale, { error: { fields } });
    if (input.phone === PHONE_IN_USE) return error(409, 'phone_in_use', locale);
    session.checkoutContact = input;
    return [200, { data: { isGuest: true, name: `${input.firstName} ${input.lastName}`, phone: input.phone, email: input.email } }];
  }

  function upload({ session, locale, contentType, raw }) {
    const t = TEXT[locale];
    const name = /^multipart\/form-data/i.test(contentType ?? '') ? (String(raw ?? '').match(/name="file"; filename="([^"]+)"/)?.[1] ?? null) : null;
    if (!name) return error(422, 'validation_failed', locale, { error: { fields: { file: [t.fileRequired] } } });
    if (!UPLOAD_TYPES.test(name)) return error(422, 'validation_failed', locale, { error: { fields: { file: [t.fileType] } } });
    const id = `mock-upload-${++uploadCounter}`;
    session.uploads ??= new Map();
    session.uploads.set(id, name);
    return [201, { data: { id, name } }];
  }

  // the mock bank (not part of the contract)
  function paymentPage(query) {
    const reference = query.get('ref') ?? '';
    const entry = references.get(reference);
    if (!entry || entry.kind !== 'payment') return [404, '<!doctype html><title>Mock bank</title><p>Unknown payment.</p>', { 'Content-Type': 'text/html; charset=utf-8' }];
    const link = (outcome, label) => `<li><a data-outcome="${outcome}" href="/api/customer/v3/__pay/finish?ref=${encodeURIComponent(reference)}&outcome=${outcome}">${label}</a></li>`;
    const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Mock bank</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:48px auto;padding:0 16px}a{display:block;padding:12px 0}</style></head>
<body>
<h1>Mock bank</h1>
<p>Payment <strong>${reference}</strong> of <strong data-testid="pay-total">${entry.totalText}</strong>.</p>
<ul>
${link('paid', 'Pay')}
${link('failed', 'Card declined')}
${link('cancelled', 'Cancel the payment')}
${link('pending', 'Pay — the bank confirms a few seconds later')}
${link('stuck', 'Pay — the bank never confirms')}
</ul>
</body>
</html>`;
    return [200, html, { 'Content-Type': 'text/html; charset=utf-8' }];
  }

  function finishPayment(query) {
    const reference = query.get('ref') ?? '';
    const outcome = query.get('outcome');
    const entry = references.get(reference);
    if (!entry || entry.kind !== 'payment') return [404, '<!doctype html><title>Mock bank</title><p>Unknown payment.</p>', { 'Content-Type': 'text/html; charset=utf-8' }];
    if (entry.status === 'started' || entry.status === 'pending') {
      if (outcome === 'paid') {
        const session = shopper.session(entry.token);
        if (session) entry.orderId = createOrder(session, entry.selections, entry.note);
        entry.status = 'paid';
      } else if (outcome === 'failed' || outcome === 'cancelled') entry.status = outcome;
      else {
        entry.status = 'pending';
        entry.settleAt = outcome === 'pending' ? now() + pendingMs : null;
      }
    }
    const back = new URL(entry.returnUrl);
    back.searchParams.set('checkout', reference);
    return [302, '', { Location: back.toString(), 'Content-Type': 'text/plain' }];
  }

  function control(method, body, token) {
    if (method === 'POST') {
      const input = body && typeof body === 'object' ? body : {};
      for (const name of Object.keys(mode)) if (name in input) mode[name] = input[name];
      if (input.price && isId(input.price.productId) && typeof input.price.amount === 'number') setPrice(input.price.productId, input.price.amount);
    }
    const session = shopper.session(token);
    // with a shopper token: the numbers of that shopper's orders, newest first (what did checkout create?)
    return [200, { mode: { ...mode }, orderRequests, orders: session ? orderRows(session).map((row) => row.en.number) : [] }];
  }

  return {
    handle(request) {
      const { method, pathname, query, token, locale, body } = request;
      settle();

      if (pathname === '/__checkout' && (method === 'POST' || method === 'GET')) return control(method, body, token);
      if (pathname === '/__pay' && method === 'GET') return paymentPage(query);
      if (pathname === '/__pay/finish' && method === 'GET') return finishPayment(query);

      const mine =
        (method === 'POST' && ['/checkout', '/orders', '/uploads'].includes(pathname)) ||
        (method === 'GET' && ['/checkout/result', '/pickup-branches'].includes(pathname)) ||
        (method === 'PUT' && pathname === '/checkout/contact');
      if (!mine) return null;

      const session = shopper.session(token);
      if (!session) return error(401, 'unauthenticated', locale);
      const call = { ...request, session };

      if (pathname === '/checkout') return [200, { data: compute(session, locale, body) }];
      if (pathname === '/orders') return placeOrder(call);
      if (pathname === '/checkout/result') return result(call);
      if (pathname === '/checkout/contact') return saveContact(call);
      if (pathname === '/uploads') return upload(call);
      return [200, { data: { items: mode.pickup ? BRANCHES.map((row) => branch(row, locale)) : [] } }];
    },
    reset() {
      restorePrices();
      mode = freshMode();
      referenceCounter = 0;
      uploadCounter = 0;
      references.clear();
      answered.clear();
      orderRequests.length = 0;
      resetAccountCounters();
    },
    /** For fixtures and tests: the checkout of a session for some choices. */
    compute: (token, locale, selections = {}) => compute(shopper.session(token), locale, selections),
    /** For tests: give a session an address without the account module. */
    addAddress: (token, row) => addressRows(shopper.session(token)).push(row),
  };
}
