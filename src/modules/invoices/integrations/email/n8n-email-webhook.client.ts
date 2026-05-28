import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { EmailProviderApiError } from './email.errors';
import {
  EMAIL_HTTP_CLIENT,
  type EmailFetchFn,
} from './email-http-client.token';
import type {
  EmailHttpFailure,
  N8nInvoiceEmailWebhookRequest,
  N8nInvoiceEmailWebhookResponse,
} from './email.types';

export function isEmailHttpFailure(error: unknown): error is EmailHttpFailure {
  return (
    typeof error === 'object' &&
    error !== null &&
    'httpStatus' in error &&
    typeof (error as EmailHttpFailure).httpStatus === 'number'
  );
}

@Injectable()
export class N8nEmailWebhookClient {
  private readonly webhookUrl?: string;
  private readonly webhookSecret?: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchFn: EmailFetchFn;

  constructor(
    configService: ConfigService<AppEnv, true>,
    @Inject(EMAIL_HTTP_CLIENT) fetchFn: EmailFetchFn,
  ) {
    this.webhookUrl = configService.get('N8N_INVOICE_EMAIL_WEBHOOK_URL', {
      infer: true,
    });
    this.webhookSecret = configService.get('N8N_INVOICE_EMAIL_WEBHOOK_SECRET', {
      infer: true,
    });
    this.requestTimeoutMs = configService.get(
      'N8N_INVOICE_EMAIL_WEBHOOK_TIMEOUT_MS',
      { infer: true },
    );
    this.fetchFn = fetchFn;
  }

  async sendInvoiceEmail(
    request: N8nInvoiceEmailWebhookRequest,
  ): Promise<N8nInvoiceEmailWebhookResponse> {
    this.assertConfigured();

    const response = await this.fetchFn(this.webhookUrl!, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Webhook-Secret': this.webhookSecret!,
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    const body = await this.parseResponseBody(response);

    if (!response.ok) {
      const failure: EmailHttpFailure = {
        httpStatus: response.status,
        body,
      };
      throw failure;
    }

    if (!this.isWebhookResponse(body)) {
      throw new EmailProviderApiError({
        category: 'UNKNOWN',
        message: 'Invoice email webhook returned an invalid response body',
        responseBody: body,
      });
    }

    return body;
  }

  private assertConfigured(): void {
    if (!this.webhookUrl) {
      throw new EmailProviderApiError({
        category: 'UNKNOWN',
        message: 'N8N_INVOICE_EMAIL_WEBHOOK_URL is not configured',
      });
    }

    if (!this.webhookSecret) {
      throw new EmailProviderApiError({
        category: 'UNKNOWN',
        message: 'N8N_INVOICE_EMAIL_WEBHOOK_SECRET is not configured',
      });
    }
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  private isWebhookResponse(body: unknown): body is N8nInvoiceEmailWebhookResponse {
    return (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as N8nInvoiceEmailWebhookResponse).success === 'boolean'
    );
  }
}
