import type { InvoiceType } from '../types/invoice.types';

export type InvoiceRecordRow = {
  id: string;
  invoice_process_id: string;
  bitrix_deal_id: string;
  invoice_type: InvoiceType;
  fakturownia_invoice_id: string;
  fakturownia_invoice_url: string;
  total_net: string;
  total_gross: string;
  vat_rate: number;
  currency: string;
  created_at: string;
};

export type InsertInvoiceRecordParams = {
  invoice_process_id: string;
  bitrix_deal_id: string;
  invoice_type: InvoiceType;
  fakturownia_invoice_id: string;
  fakturownia_invoice_url: string;
  total_net: string;
  total_gross: string;
  vat_rate: number;
  currency: string;
};
