'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { checkoutSelections, type Checkout, type CheckoutContactInput, type CheckoutSelections, type CheckoutSettings, type Locale, type PickupBranch } from '@/sdk';
import { CartEmpty } from '@/components/cart/CartEmpty';
import { MinimumOrderProgress } from '@/components/cart/MinimumOrderProgress';
import { translator } from '@/lib/i18n';
import { CheckoutItems } from './CheckoutItems';
import { CheckoutMessages, NoticeList } from './CheckoutNotices';
import { ContactSection } from './ContactSection';
import { FulfilmentSection } from './FulfilmentSection';
import { PaymentSection } from './PaymentSection';
import { PlaceOrder } from './PlaceOrder';
import { PrescriptionSection } from './PrescriptionSection';
import { PromoSection } from './PromoSection';
import { TotalLines } from './TotalLines';
import type { ComputeCheckoutAction, ComputeResult, ContactResult, PlaceOrderAction, PlaceOrderOutcome, SaveContactAction, UploadPrescriptionAction } from './types';
import styles from './Checkout.module.css';

interface CheckoutViewProps {
  /** The first answer of `POST /checkout` (no choices sent: the backend may have preselected). */
  checkout: Checkout;
  settings: CheckoutSettings;
  branches: PickupBranch[];
  locale: Locale;
  /** Idempotency key of the first attempt to place this order, made when the page loaded. */
  attemptKey: string;
  computeAction: ComputeCheckoutAction;
  saveContactAction: SaveContactAction;
  uploadAction: UploadPrescriptionAction;
  placeAction: PlaceOrderAction;
  /** Leaves the page (tests replace it). The result page and the payment page both load fresh. */
  navigate?: (url: string) => void;
}

type StepResult = ComputeResult | ContactResult;
/** One call to the backend that answers with a new checkout, given the choices of the newest one. */
type Step = (selections: CheckoutSelections) => Promise<StepResult>;

const REASONS_ID = 'checkout-reasons';
const leave = (url: string) => window.location.assign(url);

/**
 * The interactive checkout.
 *
 * The API answer is the state: `checkout` is the last `Checkout` the backend sent and everything
 * on the page is drawn from it, including which choices are selected (its echo). A change sends
 * the echoed choices plus that one change to the backend and swaps in the whole answer.
 *
 * - Changes run one after the other, each on top of the previous answer, so answers can't
 *   arrive out of order.
 * - While a change is on its way the chosen option is marked at once, but no total, fee or
 *   line amount is shown: the old ones were computed for the old choices.
 * - The order is placed for the checkout on screen, as one piece: the server action gets that
 *   object and the SDK reads its choices and its total. When the backend refuses (the total
 *   changed, something is missing, the payment method changed), its fresh checkout is shown with
 *   its message and the shopper has to tick the terms and confirm again.
 */
export function CheckoutView({ checkout: first, settings, branches, locale, attemptKey: firstKey, computeAction, saveContactAction, uploadAction, placeAction, navigate = leave }: CheckoutViewProps) {
  const t = translator(locale);
  const [checkout, setCheckout] = useState(first);
  /** The newest answer, for changes waiting in the queue (state is not updated inside them yet). */
  const latest = useRef(first);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const waiting = useRef(0);
  const [pending, setPending] = useState(false);
  /** Choices asked for and not answered yet: drawn as chosen while the backend computes. */
  const [requested, setRequested] = useState<CheckoutSelections>({});
  const [note, setNote] = useState('');
  const noteNow = useRef('');
  const [terms, setTerms] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [attemptKey, setAttemptKey] = useState(firstKey);
  const alert = useRef<HTMLParagraphElement>(null);
  const focusAlert = useRef(false);

  // A refusal to place the order must not be missed: move to its message.
  useEffect(() => {
    if (problem && focusAlert.current) alert.current?.focus();
    focusAlert.current = false;
  }, [problem]);

  // Back from the payment page through the browser's page cache: this page is stale, load it again.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  const show = useCallback((next: Checkout) => {
    latest.current = next;
    setCheckout(next);
  }, []);

  /** Runs a step after the ones already on their way; it gets the choices of the newest answer. */
  function enqueue(optimistic: CheckoutSelections, step: Step) {
    setProblem(null);
    setRequested((current) => ({ ...current, ...optimistic }));
    waiting.current += 1;
    setPending(true);

    const run = async (): Promise<StepResult> => {
      let result: StepResult;
      try {
        result = await step({ ...checkoutSelections(latest.current), note: noteNow.current.trim() || null });
      } catch (cause) {
        console.error('checkout update failed', cause);
        result = { ok: false, message: t('checkoutErrorGeneric') };
      }
      if (result.ok) {
        show(result.checkout);
        // The shopper changed something: the answer on screen is no longer the one that asked for consent.
        setConsent(false);
      } else if (result.message) setProblem(result.message);
      waiting.current -= 1;
      if (waiting.current === 0) {
        setRequested({});
        setPending(false);
      }
      return result;
    };
    const next = queue.current.then(run, run);
    queue.current = next;
    return next;
  }

  function change(patch: CheckoutSelections) {
    void enqueue(patch, (selections) => computeAction(locale, { ...selections, ...patch }));
  }

  function saveContact(contact: CheckoutContactInput): Promise<ContactResult> {
    return enqueue({}, (selections) => saveContactAction(locale, contact, selections));
  }

  function uploadPrescription(file: File) {
    void enqueue({}, async (selections) => {
      const form = new FormData();
      form.set('file', file);
      const uploaded = await uploadAction(locale, form);
      if (!uploaded.ok) return uploaded;
      return computeAction(locale, { ...selections, prescriptionFiles: [...(selections.prescriptionFiles ?? []), uploaded.file.id] });
    });
  }

  function removePrescription(fileId: string) {
    void enqueue({}, (selections) => computeAction(locale, { ...selections, prescriptionFiles: (selections.prescriptionFiles ?? []).filter((id) => id !== fileId) }));
  }

  function place() {
    if (pending || placing) return;
    setProblem(null);
    setPlacing(true);
    // `checkout` is the one on screen: its choices and its total are what the shopper confirms.
    const order = async () => {
      let outcome: PlaceOrderOutcome;
      try {
        outcome = await placeAction(locale, { checkout, note, acceptTerms: terms, attemptKey, acceptPaymentChange: consent });
      } catch (cause) {
        console.error('place order failed', cause);
        outcome = { ok: false, message: t('checkoutErrorPlace'), attemptKey };
      }
      if (outcome.ok) {
        // Stay locked: the browser is leaving for the result page or the payment page.
        navigate(outcome.url);
        return;
      }
      setAttemptKey(outcome.attemptKey);
      if (outcome.checkout) {
        // The backend's fresh checkout: show it, and ask the shopper to confirm again.
        show(outcome.checkout);
        setTerms(false);
      }
      setConsent(Boolean(outcome.needsConsent));
      focusAlert.current = true;
      setProblem(outcome.message);
      setPlacing(false);
    };
    queue.current = queue.current.then(order, order);
  }

  if (!checkout.cart.items.length) return <CartEmpty locale={locale} />;

  const echo = checkoutSelections(checkout);
  const shown = pending ? { ...echo, ...requested } : echo;
  const busy = pending || placing;
  const hasReasons = checkout.missing.length > 0 || checkout.blockers.length > 0;

  return (
    <div data-testid="checkout" aria-busy={busy || undefined}>
      {settings.notice && (
        <p className={styles.notice} data-testid="checkout-store-notice">
          {settings.notice}
        </p>
      )}
      <CheckoutMessages messages={checkout.messages} />
      <p className="visually-hidden" role="status">
        {pending ? t('checkoutUpdating') : ''}
      </p>

      <div className={styles.layout}>
        <div className={styles.sections}>
          <ContactSection checkout={checkout} settings={settings} locale={locale} busy={busy} onSave={saveContact} />
          <FulfilmentSection checkout={checkout} shown={shown} branches={branches} pending={pending} locale={locale} onChange={change} />
          <PaymentSection checkout={checkout} shown={shown} pending={pending} locale={locale} onChange={change} />
          <PrescriptionSection prescription={checkout.requirements.prescription} locale={locale} busy={busy} onUpload={uploadPrescription} onRemove={removePrescription} />
          {settings.promoCode && <PromoSection promo={checkout.promo} locale={locale} busy={busy} onChange={change} />}
          {settings.orderNote && (
            <section className={styles.section} aria-labelledby="checkout-note-title">
              <div className={styles.sectionHead}>
                <h2 id="checkout-note-title" className={styles.sectionTitle}>
                  {t('checkoutNoteTitle')}
                </h2>
              </div>
              <textarea
                className={styles.textarea}
                name="note"
                value={note}
                maxLength={1000}
                placeholder={t('checkoutNoteHint')}
                aria-labelledby="checkout-note-title"
                onChange={(event) => {
                  noteNow.current = event.target.value;
                  setNote(event.target.value);
                }}
              />
            </section>
          )}
          <CheckoutItems cart={checkout.cart} pending={pending} locale={locale} />
        </div>

        <aside className={styles.summary} aria-labelledby="checkout-summary-title" data-testid="checkout-summary">
          <h2 id="checkout-summary-title" className={styles.summaryTitle}>
            {t('checkoutSummaryTitle')}
          </h2>

          {pending ? (
            <p className={styles.updating} data-testid="checkout-updating">
              {t('checkoutUpdating')}
            </p>
          ) : (
            <>
              <TotalLines lines={checkout.totals.lines} total={checkout.totals.total} locale={locale} />
              {checkout.minimumOrder && (
                <MinimumOrderProgress minimumOrder={checkout.minimumOrder} reached={!checkout.blockers.some((blocker) => blocker.code === 'minimum_order')} locale={locale} />
              )}
            </>
          )}

          {hasReasons && (
            <div id={REASONS_ID} className={styles.reasons}>
              <NoticeList notices={checkout.missing} kind="missing" title={t('checkoutMissingTitle')} />
              <NoticeList notices={checkout.blockers} kind="blockers" title={t('checkoutBlockersTitle')} />
            </div>
          )}

          {problem && (
            <p ref={alert} className={styles.alert} role="alert" tabIndex={-1} data-testid="checkout-problem">
              {problem}
            </p>
          )}

          <PlaceOrder
            checkout={checkout}
            termsAccepted={terms}
            onTermsChange={setTerms}
            pending={pending}
            placing={placing}
            consent={consent}
            onPlace={place}
            locale={locale}
            describedBy={hasReasons ? REASONS_ID : undefined}
          />
        </aside>
      </div>
    </div>
  );
}
