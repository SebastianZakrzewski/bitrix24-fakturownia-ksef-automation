import type {
  InvoiceProcessStatus,
  InvoiceType,
  ValidationError,
} from '../types/invoice.types';

export type InvoiceProcessRow = {
  id: string;
  bitrix_deal_id: string;
  invoice_type: InvoiceType;
  status: InvoiceProcessStatus;
  idempotency_key: string;
  fakturownia_invoice_id: string | null;
  fakturownia_invoice_url: string | null;
  ksef_status: string | null;
  ksef_last_checked_at: string | null;
  validation_errors: ValidationError[] | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

export type InsertInvoiceProcessParams = {
  bitrix_deal_id: string;
  invoice_type: InvoiceType;
  status: InvoiceProcessStatus;
  idempotency_key: string;
  fakturownia_invoice_id?: string | null;
  fakturownia_invoice_url?: string | null;
  ksef_status?: string | null;
  validation_errors?: ValidationError[] | null;
  last_error_message?: string | null;
};

export type UpdateInvoiceProcessStatusParams = {
  status: InvoiceProcessStatus;
  last_error_message?: string | null;
  validation_errors?: ValidationError[] | null;
};
