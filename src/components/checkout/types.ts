import type { Checkout, CheckoutContactInput, CheckoutSelections, Locale, UploadedFile } from '@/sdk';

/**
 * What the checkout server actions answer. A successful change always carries the whole new
 * `Checkout` exactly as the backend computed it: the page swaps it in, it never patches its own copy.
 */
export type ComputeResult = { ok: true; checkout: Checkout } | { ok: false; message: string };

export type ContactResult = { ok: true; checkout: Checkout } | { ok: false; message?: string; fieldErrors?: Record<string, string> };

export type UploadResult = { ok: true; file: UploadedFile } | { ok: false; message: string };

/** What the browser sends to place the order: the checkout on screen, as one piece. */
export interface PlaceOrderRequest {
  /** The checkout the shopper is looking at. Its choices and its total are what gets ordered. */
  checkout: Checkout;
  note: string;
  acceptTerms: boolean;
  /** Idempotency key of this attempt (given by the server; reused when the outcome is unknown). */
  attemptKey: string;
  /** True when the shopper is accepting a `payment_change_needs_consent` answer. */
  acceptPaymentChange: boolean;
}

export type PlaceOrderOutcome =
  /** The order is placed or has to be paid: send the browser to `url` (our result page, or the payment page). */
  | { ok: true; url: string }
  | {
      ok: false;
      message: string;
      /** The key for the next click: the same one when the outcome is unknown, a new one after a refusal. */
      attemptKey: string;
      /** The fresh checkout the backend sent with its refusal: show it and let the shopper confirm again. */
      checkout?: Checkout;
      /** The backend changed the payment method and needs the shopper to accept it. */
      needsConsent?: boolean;
    };

export type ComputeCheckoutAction = (locale: Locale, selections: CheckoutSelections) => Promise<ComputeResult>;
export type SaveContactAction = (locale: Locale, contact: CheckoutContactInput, selections: CheckoutSelections) => Promise<ContactResult>;
export type UploadPrescriptionAction = (locale: Locale, form: FormData) => Promise<UploadResult>;
export type PlaceOrderAction = (locale: Locale, request: PlaceOrderRequest) => Promise<PlaceOrderOutcome>;

/** Changes one or more choices; the backend computes the checkout again. */
export type ChangeSelections = (patch: CheckoutSelections) => void;
