import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../types/invoice.types';
import type { FakturowniaCreateInvoiceResult } from '../integrations/fakturownia/fakturownia.types';
import { EmailProviderApiError } from '../integrations/email/email.errors';
import { EmailProviderService } from '../integrations/email/email-provider.service';
import { InvoiceEmailMapper } from '../integrations/email/invoice-email.mapper';
import type { InvoiceEmailDeliveryResult } from '../integrations/email/email.types';
import { FakturowniaService } from '../integrations/fakturownia/fakturownia.service';
import { InvoiceEventRepository } from '../repositories/invoice-event.repository';

export const CUSTOMER_INVOICE_EMAIL_SENT_EVENT = 'CUSTOMER_INVOICE_EMAIL_SENT';
export const CUSTOMER_INVOICE_EMAIL_FAILED_EVENT = 'CUSTOMER_INVOICE_EMAIL_FAILED';
export const FAKTUROWNIA_PDF_DOWNLOAD_FAILED_EVENT = 'FAKTUROWNIA_PDF_DOWNLOAD_FAILED';

export type SendCustomerInvoiceParams = {
  processId: string;
  bitrixDealId: string;
  invoiceDraft: InvoiceDraft;
  fakturowniaResult: FakturowniaCreateInvoiceResult;
};

@Injectable()
export class InvoiceEmailService {
  constructor(
    private readonly invoiceEventRepository: InvoiceEventRepository,
    private readonly fakturowniaService: FakturowniaService,
    private readonly emailProviderService: EmailProviderService,
    private readonly invoiceEmailMapper: InvoiceEmailMapper,
  ) {}

  async sendCustomerInvoice(
    params: SendCustomerInvoiceParams,
  ): Promise<InvoiceEmailDeliveryResult> {
    const alreadySent = await this.invoiceEventRepository.existsByProcessIdAndEventType(
      params.processId,
      CUSTOMER_INVOICE_EMAIL_SENT_EVENT,
    );

    if (alreadySent) {
      return {
        success: true,
        provider: 'n8n',
        sentAt: new Date().toISOString(),
      };
    }

    const pdfAttachment = await this.tryBuildPdfAttachment(
      params.processId,
      params.bitrixDealId,
      params.fakturowniaResult.fakturowniaInvoiceId,
      params.fakturowniaResult.fakturowniaInvoiceNumber,
    );

    try {
      const deliveryResult = await this.emailProviderService.sendInvoiceEmail({
        processId: params.processId,
        bitrixDealId: params.bitrixDealId,
        invoiceType: params.invoiceDraft.invoiceType,
        recipientEmail: params.invoiceDraft.buyer.customerEmail,
        recipientCompanyName: params.invoiceDraft.buyer.companyName,
        fakturowniaInvoiceId: params.fakturowniaResult.fakturowniaInvoiceId,
        fakturowniaInvoiceNumber: params.fakturowniaResult.fakturowniaInvoiceNumber,
        fakturowniaInvoiceUrl: params.fakturowniaResult.fakturowniaInvoiceUrl,
        ...(pdfAttachment ? { pdfAttachment } : {}),
      });

      await this.invoiceEventRepository.insert({
        invoice_process_id: params.processId,
        bitrix_deal_id: params.bitrixDealId,
        event_type: CUSTOMER_INVOICE_EMAIL_SENT_EVENT,
        message: 'Customer invoice email sent successfully.',
        metadata: {
          provider: deliveryResult.provider,
          ...(deliveryResult.providerMessageId
            ? { provider_message_id: deliveryResult.providerMessageId }
            : {}),
          recipient_email_redacted: this.redactEmail(
            params.invoiceDraft.buyer.customerEmail,
          ),
          pdf_attached: pdfAttachment !== undefined,
        },
      });

      return deliveryResult;
    } catch (error) {
      const failureMessage =
        error instanceof EmailProviderApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Customer invoice email delivery failed.';

      await this.invoiceEventRepository.insert({
        invoice_process_id: params.processId,
        bitrix_deal_id: params.bitrixDealId,
        event_type: CUSTOMER_INVOICE_EMAIL_FAILED_EVENT,
        message: failureMessage,
        metadata: {
          recipient_email_redacted: this.redactEmail(
            params.invoiceDraft.buyer.customerEmail,
          ),
          ...(error instanceof EmailProviderApiError
            ? {
                category: error.category,
                ...(error.errorCode ? { error_code: error.errorCode } : {}),
              }
            : {}),
        },
      });

      throw error;
    }
  }

  private async tryBuildPdfAttachment(
    processId: string,
    bitrixDealId: string,
    fakturowniaInvoiceId: string,
    fakturowniaInvoiceNumber: string,
  ): Promise<
    | {
        filename: string;
        contentBase64: string;
        contentType: 'application/pdf';
      }
    | undefined
  > {
    try {
      const pdfBytes = await this.fakturowniaService.downloadInvoicePdf(
        fakturowniaInvoiceId,
      );

      return {
        filename: this.invoiceEmailMapper.buildPdfFilename(
          fakturowniaInvoiceNumber,
        ),
        contentBase64: pdfBytes.toString('base64'),
        contentType: 'application/pdf',
      };
    } catch (error) {
      const warningMessage =
        error instanceof Error
          ? error.message
          : 'Fakturownia invoice PDF download failed.';

      await this.invoiceEventRepository.insert({
        invoice_process_id: processId,
        bitrix_deal_id: bitrixDealId,
        event_type: FAKTUROWNIA_PDF_DOWNLOAD_FAILED_EVENT,
        message: warningMessage,
        metadata: {
          fakturownia_invoice_id: fakturowniaInvoiceId,
        },
      });

      return undefined;
    }
  }

  private redactEmail(email: string): string {
    const atIndex = email.indexOf('@');

    if (atIndex <= 1) {
      return '***';
    }

    return `${email.slice(0, 1)}***${email.slice(atIndex)}`;
  }
}
