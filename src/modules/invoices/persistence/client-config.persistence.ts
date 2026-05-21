import type {
  ClientBitrixFieldMapping,
  ClientInvoiceTypeMapping,
} from '../types/client-config.types';

export type ClientConfigRow = {
  id: string;
  name: string;
  bitrix_paid_stage_id: string;
  bitrix_field_mapping: ClientBitrixFieldMapping;
  invoice_type_mapping: ClientInvoiceTypeMapping;
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
  bitrix_field_mapping: ClientBitrixFieldMapping;
  invoice_type_mapping: ClientInvoiceTypeMapping;
  default_vat_rate?: number;
  default_currency?: string;
  default_unit?: string;
  is_active?: boolean;
};
