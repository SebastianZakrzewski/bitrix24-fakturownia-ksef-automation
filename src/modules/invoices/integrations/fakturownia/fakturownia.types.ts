export type FakturowniaCreateInvoiceResult = {
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceUrl: string;
  totalNet: number;
  totalGross: number;
  currency: 'PLN';
  ksefStatus?: 'SUBMISSION_CONFIRMED' | 'SUBMISSION_ERROR' | 'STATUS_UNKNOWN';
  ksefRawStatus?: string;
};

export type FakturowniaPositionPayload = {
  name: string;
  quantity: number;
  tax: number;
  total_price_gross: number;
};

export type FakturowniaInvoicePayload = {
  kind: 'vat' | 'advance' | 'final';
  currency: 'PLN';
  buyer_name: string;
  buyer_tax_no: string;
  buyer_street: string;
  buyer_post_code: string;
  buyer_city: string;
  buyer_country: string;
  positions: FakturowniaPositionPayload[];
  advance_creation_mode?: 'amount';
  advance_value?: string;
  invoice_ids?: number[];
};

export type FakturowniaCreateInvoiceRequest = {
  api_token: string;
  invoice: FakturowniaInvoicePayload;
};

export type FakturowniaInvoiceRaw = {
  id: number | string;
  view_url?: string;
  price_net?: number | string;
  price_gross?: number | string;
  currency?: string;
  gov_status?: string | null;
};

export type FakturowniaHttpFailure = {
  httpStatus: number;
  body?: unknown;
};
