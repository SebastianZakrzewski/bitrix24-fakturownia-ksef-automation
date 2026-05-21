import type {
  InvoiceDraft,
  InvoiceType,
  ProductLine,
  ValidationError,
} from './invoice.types';

export type MappedBuyer = {
  companyId?: string;
  companyName?: string;
  nip?: string;
  street?: string;
  postalCode?: string;
  city?: string;
  country?: string;
};

export type BitrixInvoiceMappingResult = {
  bitrixDealId: string;
  invoiceType?: InvoiceType;
  buyer: MappedBuyer;
  products: ProductLine[];
  advanceAmount?: number;
  /** Copy of deal custom fields for document-type validation gate. */
  dealCustomFields: Record<string, unknown>;
};

export type InvoiceValidationContext = {
  previousAdvanceInvoiceId?: string;
};

export type ValidatedInvoiceMapping = {
  bitrixDealId: string;
  invoiceType: InvoiceType;
  buyer: InvoiceDraft['buyer'];
  products: ProductLine[];
  advanceAmount?: number;
  previousAdvanceInvoiceId?: string;
};

export type InvoiceValidationResult =
  | { ok: true; data: ValidatedInvoiceMapping }
  | { ok: false; errors: ValidationError[] };
