/** What the send action gives back to the form (it never throws for API errors). */
export interface PrescriptionFormState {
  ok?: boolean;
  /** The backend's thank-you text, or what went wrong. */
  message?: string;
  /** The id of the prescription just sent. */
  sentId?: string;
  /** Per field (`addressId`, `files`, `prescriptionNumber`...), the backend's first message. */
  fieldErrors?: Record<string, string>;
  /** What the customer typed (never file ids). */
  values?: Record<string, string>;
}
export type SendPrescriptionAction = (state: PrescriptionFormState, formData: FormData) => Promise<PrescriptionFormState>;
