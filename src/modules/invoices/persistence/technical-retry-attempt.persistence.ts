import type { InvoiceProcessStatus } from '../types/invoice.types';
import type { TechnicalRetryTargetAction } from '../dto/technical-retry-request.dto';

export type TechnicalRetryAttemptRow = {
  id: string;
  invoice_process_id: string;
  requested_by: string;
  reason: string;
  from_status: InvoiceProcessStatus;
  target_action: TechnicalRetryTargetAction;
  allowed: boolean;
  blocked_reason: string | null;
  created_at: string;
};

export type InsertTechnicalRetryAttemptParams = {
  invoice_process_id: string;
  requested_by: string;
  reason: string;
  from_status: InvoiceProcessStatus;
  target_action: TechnicalRetryTargetAction;
  allowed: boolean;
  blocked_reason?: string | null;
};
