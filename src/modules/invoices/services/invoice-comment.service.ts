import { Injectable } from '@nestjs/common';
import type { InvoiceType, ValidationError } from '../types/invoice.types';

const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  FULL: 'Pełna',
  ADVANCE: 'Zaliczkowa',
  FINAL: 'Dopełniająca',
};

export type BuildInvoiceCreatedCommentParams = {
  invoiceType: InvoiceType;
  fakturowniaInvoiceUrl: string;
  fakturowniaInvoiceId?: string;
};

@Injectable()
export class InvoiceCommentService {
  buildInvoiceCreatedComment(params: BuildInvoiceCreatedCommentParams): string {
    const typeLabel = INVOICE_TYPE_LABELS[params.invoiceType];
    const idPart =
      params.fakturowniaInvoiceId !== undefined
        ? ` (ID: ${params.fakturowniaInvoiceId})`
        : '';

    return [
      `[SellGenius] Faktura ${typeLabel}${idPart} utworzona w Fakturownia.`,
      `Link do faktury: ${params.fakturowniaInvoiceUrl}`,
    ].join('\n');
  }

  buildValidationFailureComment(params: { errors: ValidationError[] }): string {
    const lines = params.errors.map(
      (error) => `- ${error.code}: ${error.message}`,
    );

    return ['[SellGenius] Walidacja faktury nie powiodła się:', ...lines].join(
      '\n',
    );
  }
}
