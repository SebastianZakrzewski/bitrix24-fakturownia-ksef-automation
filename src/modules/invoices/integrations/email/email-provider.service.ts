import { Injectable } from '@nestjs/common';
import { EmailProviderApiError } from './email.errors';
import { EmailProviderErrorMapper } from './email-provider.error-mapper';
import { InvoiceEmailMapper } from './invoice-email.mapper';
import { N8nEmailWebhookClient } from './n8n-email-webhook.client';
import type {
  InvoiceEmailDeliveryResult,
  InvoiceEmailPayload,
} from './email.types';

@Injectable()
export class EmailProviderService {
  constructor(
    private readonly client: N8nEmailWebhookClient,
    private readonly mapper: InvoiceEmailMapper,
    private readonly errorMapper: EmailProviderErrorMapper,
  ) {}

  async sendInvoiceEmail(
    payload: InvoiceEmailPayload,
  ): Promise<InvoiceEmailDeliveryResult> {
    const request = this.mapper.toWebhookRequest(payload);

    try {
      const response = await this.client.sendInvoiceEmail(request);
      const mapped = this.mapper.toDeliveryResult(response);

      if (!mapped.success) {
        throw new EmailProviderApiError({
          category: 'CLIENT',
          message:
            mapped.errorMessage ??
            'Invoice email webhook reported unsuccessful delivery',
          errorCode: mapped.errorCode,
        });
      }

      return {
        success: true,
        provider: 'n8n',
        providerMessageId: mapped.providerMessageId,
        sentAt: mapped.sentAt,
      };
    } catch (error) {
      throw this.errorMapper.map(error);
    }
  }
}
