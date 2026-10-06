/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BankDetails } from '@/sdk';
import { BankDetailsView, type SaveBankDetailsAction } from './BankDetailsView';

const details: BankDetails = {
  title: 'Bank details',
  hint: 'HINT-FROM-API',
  fields: [
    { name: 'preferredMethod', label: 'Refund method', kind: 'select', required: true, placeholder: null, multiple: false, hint: null, maxLength: null, options: [{ value: 'bank_account', label: 'Bank account', selected: true }, { value: 'post_office', label: 'Post office', selected: false }] },
    { name: 'iban', label: 'IBAN', kind: 'text', required: true, placeholder: null, options: [], multiple: false, hint: null, maxLength: 50, showWhen: [{ field: 'preferredMethod', values: ['bank_account'] }] },
    { name: 'nationalId', label: 'National ID number', kind: 'text', required: true, placeholder: null, options: [], multiple: false, hint: null, maxLength: 14, showWhen: [{ field: 'preferredMethod', values: ['post_office'] }] },
  ],
  saved: [{ label: 'IBAN', value: '•••• 0002' }],
};

describe('bank details (as the backend wrote them)', () => {
  it('shows what is on record masked, and the fields of the chosen method only', async () => {
    const user = userEvent.setup();
    render(<BankDetailsView locale="en" details={details} saveAction={vi.fn<SaveBankDetailsAction>()} />);
    expect(screen.getByTestId('bank-details-saved')).toHaveTextContent('•••• 0002');
    expect(screen.getByLabelText(/IBAN/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/National ID/)).toBeNull();

    await user.selectOptions(screen.getByLabelText('Refund method'), 'post_office');
    expect(screen.queryByLabelText(/IBAN/)).toBeNull();
    expect(screen.getByLabelText(/National ID/)).toBeInTheDocument();
  });

  it('shows the backend answer after saving', async () => {
    const user = userEvent.setup();
    const saveAction = vi.fn<SaveBankDetailsAction>().mockResolvedValue({ ok: true, message: 'Your bank details were saved.', details: { ...details, saved: [{ label: 'IBAN', value: '•••• 6789' }] } });
    render(<BankDetailsView locale="en" details={details} saveAction={saveAction} />);
    await user.type(screen.getByLabelText(/IBAN/), 'EG110003000000000000123456789');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByTestId('bank-details-notice')).toHaveTextContent('Your bank details were saved.'));
    expect(screen.getByTestId('bank-details-saved')).toHaveTextContent('•••• 6789');
  });
});
