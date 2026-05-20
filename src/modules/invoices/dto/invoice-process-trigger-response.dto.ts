import {
  InvoiceProcessTriggerStatus,
  InvoiceType,
} from '../types/invoice.types';

export type InvoiceProcessTriggerResponseDto = {
  process_id?: string;
  status: InvoiceProcessTriggerStatus;
  bitrix_deal_id: string;
  invoice_type?: InvoiceType;
  message: string;
};
