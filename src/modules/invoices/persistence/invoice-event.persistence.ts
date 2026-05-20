export type InvoiceEventRow = {
  id: string;
  invoice_process_id: string | null;
  bitrix_deal_id: string | null;
  event_type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type InsertInvoiceEventParams = {
  invoice_process_id?: string | null;
  bitrix_deal_id?: string | null;
  event_type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};
