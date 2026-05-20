import { InvoiceProcessStatus } from '../types/invoice.types';

export type TechnicalRetryResponseDto = {
  retry_attempt_id: string;
  invoice_process_id: string;
  allowed: boolean;
  blocked_reason?: string;
  resulting_status?: InvoiceProcessStatus;
  message: string;
};
