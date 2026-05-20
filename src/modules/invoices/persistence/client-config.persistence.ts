export type ClientConfigRow = {
  id: string;
  name: string;
  bitrix_paid_stage_id: string;
  bitrix_field_mapping: Record<string, unknown>;
  invoice_type_mapping: Record<string, unknown>;
  default_vat_rate: number;
  default_currency: string;
  default_unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InsertClientConfigParams = {
  name: string;
  bitrix_paid_stage_id: string;
  bitrix_field_mapping: Record<string, unknown>;
  invoice_type_mapping: Record<string, unknown>;
  default_vat_rate?: number;
  default_currency?: string;
  default_unit?: string;
  is_active?: boolean;
};
