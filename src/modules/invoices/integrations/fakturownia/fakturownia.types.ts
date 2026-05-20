export type FakturowniaCreateInvoiceResult = {
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceUrl: string;
  totalNet: number;
  totalGross: number;
  currency: 'PLN';
  ksefStatus?: 'SUBMISSION_CONFIRMED' | 'SUBMISSION_ERROR' | 'STATUS_UNKNOWN';
  ksefRawStatus?: string;
};
