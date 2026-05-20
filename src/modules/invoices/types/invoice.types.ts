export type InvoiceType = 'FULL' | 'ADVANCE' | 'FINAL';

export type InvoiceProcessStatus =
  | 'TRIGGER_RECEIVED'
  | 'VALIDATION_FAILED'
  | 'INVOICE_CREATION_IN_PROGRESS'
  | 'FAKTUROWNIA_ERROR'
  | 'UNKNOWN_AFTER_TIMEOUT'
  | 'INVOICE_CREATED'
  | 'KSEF_SUBMISSION_CONFIRMED'
  | 'KSEF_SUBMISSION_ERROR'
  | 'KSEF_STATUS_UNKNOWN'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'COMPLETED';

export type InvoiceProcessTriggerStatus =
  | InvoiceProcessStatus
  | 'STALE_TRIGGER_IGNORED';

export type InvoiceEventType = 'STALE_TRIGGER_IGNORED';

export type ProductLine = {
  source: 'DEAL_FIELDS' | 'DEAL_PRODUCT_ROW';
  sourceId?: string;
  name: string;
  quantity: number;
  unit: 'szt.';
  unitGrossPrice: number;
  totalGross: number;
  vatRate: 23;
};

export type InvoiceDraft = {
  bitrixDealId: string;
  invoiceType: InvoiceType;
  buyer: {
    companyName: string;
    nip: string;
    street: string;
    postalCode: string;
    city: string;
    country: string;
  };
  products: ProductLine[];
  advanceAmount?: number;
  previousAdvanceInvoiceId?: string;
  currency: 'PLN';
  vatRate: 23;
};

export type InvoiceEvent = {
  invoiceProcessId?: string;
  bitrixDealId?: string;
  eventType: InvoiceEventType;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ValidationError = {
  code:
    | 'MISSING_INVOICE_TYPE'
    | 'MISSING_COMPANY'
    | 'MISSING_NIP'
    | 'MISSING_COMPANY_NAME'
    | 'MISSING_COMPANY_ADDRESS'
    | 'MISSING_PRODUCTS'
    | 'INVALID_PRODUCT_LINE'
    | 'MISSING_ADVANCE_AMOUNT'
    | 'INVALID_ADVANCE_AMOUNT'
    | 'MISSING_PREVIOUS_ADVANCE_INVOICE'
    | 'DUPLICATE_INVOICE'
    | 'DEAL_NOT_IN_PAID_STAGE';
  message: string;
  field?: string;
  source?: 'BITRIX_DEAL' | 'BITRIX_COMPANY' | 'PRODUCT_MAPPING' | 'INVOICE_RULE';
};
