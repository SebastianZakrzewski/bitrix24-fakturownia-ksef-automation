import { EmailProviderApiError } from './email.errors';
import { EmailProviderErrorMapper } from './email-provider.error-mapper';
import { EmailProviderService } from './email-provider.service';
import { InvoiceEmailMapper } from './invoice-email.mapper';
import { N8nEmailWebhookClient } from './n8n-email-webhook.client';

describe('EmailProviderService', () => {
  const payload = {
    processId: 'process-1',
    bitrixDealId: '27000',
    invoiceType: 'FULL' as const,
    recipientEmail: 'client@example.com',
    recipientCompanyName: 'Evapremium Sp. z o.o.',
    fakturowniaInvoiceId: '987654',
    fakturowniaInvoiceNumber: '39/05/2026',
    fakturowniaInvoiceUrl: 'https://evapremium.fakturownia.pl/invoices/987654',
  };

  it('returns delivery result when webhook reports success', async () => {
    const client = {
      sendInvoiceEmail: jest.fn().mockResolvedValue({
        success: true,
        provider_message_id: 'msg-1',
        sent_at: '2026-01-01T00:00:00.000Z',
      }),
    } as unknown as N8nEmailWebhookClient;

    const service = new EmailProviderService(
      client,
      new InvoiceEmailMapper(),
      new EmailProviderErrorMapper(),
    );

    await expect(service.sendInvoiceEmail(payload)).resolves.toEqual({
      success: true,
      provider: 'n8n',
      providerMessageId: 'msg-1',
      sentAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('maps webhook success=false to EmailProviderApiError', async () => {
    const client = {
      sendInvoiceEmail: jest.fn().mockResolvedValue({
        success: false,
        error_message: 'Template missing',
        error_code: 'TEMPLATE_ERROR',
      }),
    } as unknown as N8nEmailWebhookClient;

    const service = new EmailProviderService(
      client,
      new InvoiceEmailMapper(),
      new EmailProviderErrorMapper(),
    );

    await expect(service.sendInvoiceEmail(payload)).rejects.toMatchObject({
      name: 'EmailProviderApiError',
      category: 'CLIENT',
      errorCode: 'TEMPLATE_ERROR',
    } satisfies Partial<EmailProviderApiError>);
  });
});
