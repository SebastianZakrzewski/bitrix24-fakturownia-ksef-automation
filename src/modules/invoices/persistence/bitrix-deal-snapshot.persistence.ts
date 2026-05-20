import type { InvoiceType } from '../types/invoice.types';

export type BitrixDealSnapshotRow = {
  id: string;
  invoice_process_id: string;
  bitrix_deal_id: string;
  bitrix_company_id: string | null;
  raw_deal: Record<string, unknown>;
  raw_company: Record<string, unknown> | null;
  raw_product_rows: Record<string, unknown>[] | null;
  extracted_invoice_type: InvoiceType | null;
  extracted_advance_amount: string | null;
  extracted_products: Record<string, unknown>[] | null;
  created_at: string;
};

export type InsertBitrixDealSnapshotParams = {
  invoice_process_id: string;
  bitrix_deal_id: string;
  bitrix_company_id?: string | null;
  raw_deal: Record<string, unknown>;
  raw_company?: Record<string, unknown> | null;
  raw_product_rows?: Record<string, unknown>[] | null;
  extracted_invoice_type?: InvoiceType | null;
  extracted_advance_amount?: string | null;
  extracted_products?: Record<string, unknown>[] | null;
};
