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

export type FakturowniaInvoiceOrderLinkage = {
  fakturowniaOrderId: string;
  fakturowniaOrderNumber?: string | null;
};

export type FakturowniaVatInvoicePayload = {
  kind: 'vat';
  currency: 'PLN';
  buyer_name: string;
  buyer_tax_no: string;
  buyer_street: string;
  buyer_post_code: string;
  buyer_city: string;
  buyer_country: string;
  positions: FakturowniaPositionPayload[];
};

export type FakturowniaAdvanceFromOrderPayload = {
  kind: 'advance';
  copy_invoice_from: number;
  advance_creation_mode: 'amount';
  advance_value: string;
  position_name: string;
};

export type FakturowniaFinalFromOrderPayload = {
  kind: 'final';
  copy_invoice_from: number;
  invoice_ids: number[];
};

export type FakturowniaInvoicePayload =
  | FakturowniaVatInvoicePayload
  | FakturowniaAdvanceFromOrderPayload
  | FakturowniaFinalFromOrderPayload;

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

export type FakturowniaOrderPositionPayload = FakturowniaPositionPayload;

export type FakturowniaOrderPayload = {
  kind: 'estimate';
  currency: 'PLN';
  oid: string;
  buyer_name: string;
  buyer_tax_no: string;
  buyer_street: string;
  buyer_post_code: string;
  buyer_city: string;
  buyer_country: string;
  positions: FakturowniaOrderPositionPayload[];
};

export type FakturowniaCreateOrderRequest = {
  api_token: string;
  invoice: FakturowniaOrderPayload;
};

export type FakturowniaOrderRaw = {
  id?: number | string;
  number?: string | null;
  oid?: string;
};

export type FakturowniaCreateOrderResult = {
  fakturowniaOrderId: string;
  fakturowniaOrderNumber?: string;
};

export type FakturowniaDocumentRequest =
  | FakturowniaCreateInvoiceRequest
  | FakturowniaCreateOrderRequest;
