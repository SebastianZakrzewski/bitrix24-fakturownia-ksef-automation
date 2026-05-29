import { Injectable } from '@nestjs/common';
import type {
  InvoiceEmailPayload,
  N8nInvoiceEmailWebhookRequest,
  N8nInvoiceEmailWebhookResponse,
} from './email.types';

@Injectable()
export class InvoiceEmailMapper {
  toWebhookRequest(payload: InvoiceEmailPayload): N8nInvoiceEmailWebhookRequest {
    return {
      process_id: payload.processId,
      bitrix_deal_id: payload.bitrixDealId,
      invoice_type: payload.invoiceType,
      recipient_email: payload.recipientEmail,
      recipient_company_name: payload.recipientCompanyName,
      invoice_number: payload.fakturowniaInvoiceNumber,
      fakturownia_invoice_id: payload.fakturowniaInvoiceId,
      fakturownia_invoice_url: payload.fakturowniaInvoiceUrl,
      ...(payload.pdfAttachment
        ? {
            pdf_attachment: {
              filename: payload.pdfAttachment.filename,
              content_base64: payload.pdfAttachment.contentBase64,
              content_type: payload.pdfAttachment.contentType,
            },
          }
        : {}),
    };
  }

  toDeliveryResult(
    response: N8nInvoiceEmailWebhookResponse,
  ): {
    success: boolean;
    providerMessageId?: string;
    sentAt: string;
    errorCode?: string;
    errorMessage?: string;
  } {
    return {
      success: response.success,
      providerMessageId: response.provider_message_id,
      sentAt: response.sent_at ?? new Date().toISOString(),
      errorCode: response.error_code,
      errorMessage: response.error_message,
    };
  }

  buildPdfFilename(invoiceNumber: string): string {
    const safeName = invoiceNumber.replace(/[/\\.]/g, '-');

    return `faktura-${safeName}.pdf`;
  }
}
