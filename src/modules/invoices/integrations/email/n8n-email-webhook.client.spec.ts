import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { AppEnv } from '../../../../config/env.validation';
import { EmailProviderApiError } from './email.errors';
import { EMAIL_HTTP_CLIENT, type EmailFetchFn } from './email-http-client.token';
import { N8nEmailWebhookClient } from './n8n-email-webhook.client';

describe('N8nEmailWebhookClient', () => {
  const webhookUrl = 'https://n8n.example.com/webhook/invoice-email';
  const webhookSecret = 'webhook-secret';

  const createClient = async (
    fetchFn: EmailFetchFn,
    config: Record<string, unknown> = {
      N8N_INVOICE_EMAIL_WEBHOOK_URL: webhookUrl,
      N8N_INVOICE_EMAIL_WEBHOOK_SECRET: webhookSecret,
      N8N_INVOICE_EMAIL_WEBHOOK_TIMEOUT_MS: 30000,
    },
  ) => {
    const configService = {
      get: (key: string) => config[key],
    } as unknown as ConfigService<AppEnv, true>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: configService },
        { provide: EMAIL_HTTP_CLIENT, useValue: fetchFn },
        N8nEmailWebhookClient,
      ],
    }).compile();

    return moduleRef.get(N8nEmailWebhookClient);
  };

  it('posts invoice email payload to n8n webhook', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        provider_message_id: 'msg-1',
        sent_at: '2026-01-01T00:00:00.000Z',
      }),
    });

    const client = await createClient(fetchFn);

    const result = await client.sendInvoiceEmail({
      process_id: 'process-1',
      bitrix_deal_id: '27000',
      invoice_type: 'FULL',
      recipient_email: 'client@example.com',
      recipient_company_name: 'Evapremium Sp. z o.o.',
      fakturownia_invoice_id: '987654',
      fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/987654',
    });

    expect(result.success).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Webhook-Secret': webhookSecret,
        },
      }),
    );
  });

  it('throws HTTP failure object on non-2xx response', async () => {
    const fetchFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error_message: 'SMTP unavailable' }),
    });

    const client = await createClient(fetchFn);

    await expect(
      client.sendInvoiceEmail({
        process_id: 'process-1',
        bitrix_deal_id: '27000',
        invoice_type: 'FULL',
        recipient_email: 'client@example.com',
        recipient_company_name: 'Evapremium Sp. z o.o.',
        fakturownia_invoice_id: '987654',
        fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/987654',
      }),
    ).rejects.toEqual({
      httpStatus: 500,
      body: { error_message: 'SMTP unavailable' },
    });
  });

  it('throws when webhook URL is not configured', async () => {
    const client = await createClient(jest.fn(), {
      N8N_INVOICE_EMAIL_WEBHOOK_SECRET: webhookSecret,
      N8N_INVOICE_EMAIL_WEBHOOK_TIMEOUT_MS: 30000,
    });

    await expect(
      client.sendInvoiceEmail({
        process_id: 'process-1',
        bitrix_deal_id: '27000',
        invoice_type: 'FULL',
        recipient_email: 'client@example.com',
        recipient_company_name: 'Evapremium Sp. z o.o.',
        fakturownia_invoice_id: '987654',
        fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/987654',
      }),
    ).rejects.toMatchObject({
      name: 'EmailProviderApiError',
      message: 'N8N_INVOICE_EMAIL_WEBHOOK_URL is not configured',
    } satisfies Partial<EmailProviderApiError>);
  });
});
