import {
  InvoiceProcessStatus,
  InvoiceType,
} from '../../invoices/types/invoice.types';

export type ClientInvoiceProcessListItemDto = {
  process_id: string;
  bitrix_deal_id: string;
  bitrix_deal_url?: string;
  invoice_type: InvoiceType;
  status: InvoiceProcessStatus;
  fakturownia_invoice_url?: string;
  total_gross?: number;
  currency: 'PLN';
  last_error_message?: string;
  created_at: string;
  completed_at?: string;
};
