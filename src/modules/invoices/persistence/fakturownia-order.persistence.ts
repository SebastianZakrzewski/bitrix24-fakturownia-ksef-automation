export type FakturowniaOrderRow = {
  id: string;
  bitrix_deal_id: string;
  fakturownia_order_id: string;
  fakturownia_order_number: string | null;
  created_from_invoice_process_id: string | null;
  created_at: string;
  updated_at: string;
};

export type InsertFakturowniaOrderParams = {
  bitrix_deal_id: string;
  fakturownia_order_id: string;
  fakturownia_order_number?: string;
  created_from_invoice_process_id?: string;
};
