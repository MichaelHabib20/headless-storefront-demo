/**
 * The customer's prescriptions (contract: contract/openapi.yaml, design: account-extras-v3-design.md §2).
 * Customer token only: a guest token answers 401 `unauthenticated`. 404 `not_found` while the store
 * takes no prescriptions. Pages call these through src/lib, never HTTP.
 */
import type { StorefrontClient } from './http';
import type { ShopperContext } from './shopper';
import type { CancellationReasons, Prescription, PrescriptionForm, PrescriptionInput, PrescriptionSent, PrescriptionsPage } from './types';

const prescription = (id: string) => `prescriptions/${encodeURIComponent(id)}`;

/** How to draw the form: texts, fields, address choices, and what blocks sending (`blockers`, `canSend`). */
export const getPrescriptionForm = (client: StorefrontClient, ctx: ShopperContext) => client.request<PrescriptionForm>('GET', 'prescriptions/form', ctx);

/** One page of the customer's prescriptions, newest first. */
export const getPrescriptions = (client: StorefrontClient, ctx: ShopperContext, page = 1, perPage = 10) =>
  client.request<PrescriptionsPage>('GET', 'prescriptions', { ...ctx, query: { page: String(page), perPage: String(perPage) } });

/**
 * Sends a prescription. `files` are ids from `uploadFile`. 422 → `validation` with `fieldErrors`
 * by field name; 409 `prescription_blocked` while the form has blockers.
 */
export const sendPrescription = (client: StorefrontClient, ctx: ShopperContext, input: PrescriptionInput) =>
  client.request<PrescriptionSent>('POST', 'prescriptions', { ...ctx, body: input });

export const getPrescriptionCancellationReasons = (client: StorefrontClient, ctx: ShopperContext) =>
  client.request<CancellationReasons>('GET', 'prescriptions/cancellation-reasons', ctx);

/** Only while `actions.canCancel`; 409 `cannot_cancel` otherwise. Answers the prescription after the change. */
export const cancelPrescription = (client: StorefrontClient, ctx: ShopperContext, prescriptionId: string, input: { reasonId: number; note?: string | null }) =>
  client.request<Prescription>('POST', `${prescription(prescriptionId)}/cancel`, { ...ctx, body: input });
