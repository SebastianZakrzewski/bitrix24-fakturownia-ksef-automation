import { Injectable } from '@nestjs/common';
import type { ValidatedInvoiceMapping } from '../types/invoice-mapping.types';
import type { InvoiceDraft } from '../types/invoice.types';

@Injectable()
export class InvoiceDraftBuilderService {
  build(validated: ValidatedInvoiceMapping): InvoiceDraft {
    const draft: InvoiceDraft = {
      bitrixDealId: validated.bitrixDealId,
      invoiceType: validated.invoiceType,
      buyer: validated.buyer,
      products: validated.products,
      currency: 'PLN',
      vatRate: 23,
    };

    if (validated.invoiceType === 'ADVANCE' && validated.advanceAmount !== undefined) {
      draft.advanceAmount = validated.advanceAmount;
    }

    if (
      validated.invoiceType === 'FINAL' &&
      validated.previousAdvanceInvoiceId !== undefined
    ) {
      draft.previousAdvanceInvoiceId = validated.previousAdvanceInvoiceId;
    }

    return draft;
  }
}
