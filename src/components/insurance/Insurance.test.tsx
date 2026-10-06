/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FormFields } from '@/components/content/FormFields';
import { fieldShown, watchedValues } from '@/components/content/form-values';
import { insurancePageFixture, insurancePrescriptionFormFixture } from '@/test/insurance-fixtures';
import type { DeleteInsuranceAction, SaveInsuranceAction } from './types';
import { InsuranceView } from './InsuranceView';

describe('showWhen (backend-described conditional fields)', () => {
  it('a field shows only while every condition holds', () => {
    const approval = { showWhen: [{ field: 'type', values: ['insurance'] }, { field: 'preApproved', values: ['yes'] }] };
    expect(fieldShown({}, {})).toBe(true);
    expect(fieldShown(approval, { type: 'insurance', preApproved: 'no' })).toBe(false);
    expect(fieldShown(approval, { type: 'insurance', preApproved: 'yes' })).toBe(true);
    expect(fieldShown(approval, { type: 'cash', preApproved: 'yes' })).toBe(false);
  });

  it('the watched fields start from what was typed, else the backend selected option', () => {
    const fields = insurancePrescriptionFormFixture('en').fields;
    expect(watchedValues(fields)).toEqual({ type: 'cash', preApproved: 'no' });
    expect(watchedValues(fields, { type: 'insurance' })).toEqual({ type: 'insurance', preApproved: 'no' });
  });

  it('the prescription form shows the insurance fields only for the insurance kind', async () => {
    const user = userEvent.setup();
    render(<FormFields locale="en" fields={insurancePrescriptionFormFixture('en').fields} idPrefix="rx" />);
    expect(screen.queryByLabelText(/Insurance details/)).toBeNull();

    await user.selectOptions(screen.getByLabelText('Prescription type'), 'insurance');
    expect(screen.getByLabelText(/Insurance details/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Approval number/)).toBeNull();

    await user.selectOptions(screen.getByLabelText('Approval'), 'yes');
    expect(screen.getByLabelText(/Approval number/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Prescription type'), 'cash');
    expect(screen.queryByLabelText(/Approval number/)).toBeNull();
  });
});

describe('insurance page (as the backend wrote it)', () => {
  it('profiles with the masked ID and photo count; the form the backend describes (EN + AR)', () => {
    const page = insurancePageFixture('en');
    const { unmount } = render(<InsuranceView locale="en" page={page} saveAction={vi.fn<SaveInsuranceAction>()} deleteAction={vi.fn<DeleteInsuranceAction>()} uploadAction={vi.fn()} />);
    const card = screen.getByTestId('insurance-profile');
    expect(card).toHaveTextContent(page.items[0].label);
    expect(card).toHaveTextContent(page.items[0].nationalId!);
    expect(within(screen.getByTestId('insurance-form')).getByLabelText(/Insurance company/)).toBeInTheDocument();
    unmount();

    render(<InsuranceView locale="ar" page={insurancePageFixture('ar')} saveAction={vi.fn<SaveInsuranceAction>()} deleteAction={vi.fn<DeleteInsuranceAction>()} uploadAction={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'إضافة بيانات تأمين' })).toBeInTheDocument();
  });

  it('deleting shows the backend message and its new page', async () => {
    const user = userEvent.setup();
    const page = insurancePageFixture('en');
    const deleteAction = vi.fn<DeleteInsuranceAction>().mockResolvedValue({ ok: true, message: 'Your insurance details were deleted.', page: { ...page, items: [] } });
    render(<InsuranceView locale="en" page={page} saveAction={vi.fn<SaveInsuranceAction>()} deleteAction={deleteAction} uploadAction={vi.fn()} />);

    await user.click(screen.getByTestId('insurance-delete'));
    await waitFor(() => expect(screen.getByTestId('insurance-notice')).toHaveTextContent('Your insurance details were deleted.'));
    expect(deleteAction).toHaveBeenCalledWith('en', page.items[0].id);
    expect(screen.queryByTestId('insurance-profile')).toBeNull();
  });

  it('editing starts from the company and name on record, and sends the profile id', async () => {
    const user = userEvent.setup();
    render(<InsuranceView locale="en" page={insurancePageFixture('en')} saveAction={vi.fn<SaveInsuranceAction>()} deleteAction={vi.fn<DeleteInsuranceAction>()} uploadAction={vi.fn()} />);
    await user.click(screen.getByTestId('insurance-edit'));
    const form = screen.getByTestId('insurance-form');
    expect(within(form).getByLabelText(/Insurance company/)).toHaveValue('1');
    expect(within(form).getByLabelText(/Beneficiary name/)).toHaveValue('Mona Ali');
    expect(form.querySelector('input[name="profileId"]')).toHaveValue('7');
  });
});
