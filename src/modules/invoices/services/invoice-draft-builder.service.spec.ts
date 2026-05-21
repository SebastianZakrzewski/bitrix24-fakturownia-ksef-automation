import type { ValidatedInvoiceMapping } from '../types/invoice-mapping.types';
import { InvoiceDraftBuilderService } from './invoice-draft-builder.service';

describe('InvoiceDraftBuilderService', () => {
  const builder = new InvoiceDraftBuilderService();

  const baseValidated = (): ValidatedInvoiceMapping => ({
    bitrixDealId: '27000',
    invoiceType: 'FULL',
    buyer: {
      companyName: 'Evapremium Sp. z o.o.',
      nip: '1234567890',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    products: [
      {
        source: 'DEAL_FIELDS',
        name: 'Dywaniki Evapremium',
        quantity: 1,
        unit: 'szt.',
        unitGrossPrice: 6499,
        totalGross: 6499,
        vatRate: 23,
      },
    ],
  });

  it('builds FULL InvoiceDraft with PLN and VAT 23', () => {
    const draft = builder.build(baseValidated());

    expect(draft).toEqual({
      bitrixDealId: '27000',
      invoiceType: 'FULL',
      buyer: baseValidated().buyer,
      products: baseValidated().products,
      currency: 'PLN',
      vatRate: 23,
    });
  });

  it('includes advanceAmount only for ADVANCE', () => {
    const draft = builder.build({
      ...baseValidated(),
      invoiceType: 'ADVANCE',
      advanceAmount: 3000,
    });

    expect(draft.advanceAmount).toBe(3000);
    expect(draft.previousAdvanceInvoiceId).toBeUndefined();
  });

  it('includes previousAdvanceInvoiceId only for FINAL', () => {
    const draft = builder.build({
      ...baseValidated(),
      invoiceType: 'FINAL',
      previousAdvanceInvoiceId: 'rec-advance-1',
    });

    expect(draft.previousAdvanceInvoiceId).toBe('rec-advance-1');
    expect(draft.advanceAmount).toBeUndefined();
  });
});
