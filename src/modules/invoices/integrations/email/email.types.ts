import type { InvoiceType } from '../../types/invoice.types';

export type InvoiceEmailPayload = {
  processId: string;
  bitrixDealId: string;
  invoiceType: InvoiceType;
  recipientEmail: string;
  recipientCompanyName: string;
  fakturowniaInvoiceId: string;
  fakturowniaInvoiceNumber: string;
  fakturowniaInvoiceUrl: string;
  pdfAttachment?: {
    filename: string;
    contentBase64: string;
    contentType: 'application/pdf';
  };
};

export type InvoiceEmailDeliveryResult = {
  success: boolean;
  providerMessageId?: string;
  provider: string;
  sentAt: string;
  errorCode?: string;
  errorMessage?: string;
};

export type N8nInvoiceEmailWebhookRequest = {
  process_id: string;
  bitrix_deal_id: string;
  invoice_type: InvoiceType;
  recipient_email: string;
  recipient_company_name: string;
  invoice_number: string;
  fakturownia_invoice_id: string;
  fakturownia_invoice_url: string;
  pdf_attachment?: {
    filename: string;
    content_base64: string;
    content_type: 'application/pdf';
  };
};

export type N8nInvoiceEmailWebhookResponse = {
  success: boolean;
  provider_message_id?: string;
  sent_at?: string;
  error_code?: string;
  error_message?: string;
};

export type EmailHttpFailure = {
  httpStatus: number;
  body?: unknown;
};
