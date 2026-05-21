import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaApiError } from './fakturownia.errors';
import type {
  FakturowniaCreateInvoiceRequest,
  FakturowniaCreateOrderRequest,
  FakturowniaDocumentRequest,
  FakturowniaHttpFailure,
  FakturowniaInvoicePayload,
  FakturowniaInvoiceRaw,
  FakturowniaOrderPayload,
  FakturowniaOrderRaw,
} from './fakturownia.types';

export type FakturowniaFetchFn = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function isFakturowniaHttpFailure(
  error: unknown,
): error is FakturowniaHttpFailure {
  return (
    typeof error === 'object' &&
    error !== null &&
    'httpStatus' in error &&
    typeof (error as FakturowniaHttpFailure).httpStatus === 'number'
  );
}

@Injectable()
export class FakturowniaClient {
  private readonly baseUrl?: string;
  private readonly apiToken?: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchFn: FakturowniaFetchFn;

  constructor(
    configService: ConfigService<AppEnv, true>,
    fetchFn: FakturowniaFetchFn = fetch,
  ) {
    this.baseUrl = configService.get('FAKTUROWNIA_BASE_URL', { infer: true });
    this.apiToken = configService.get('FAKTUROWNIA_API_TOKEN', { infer: true });
    this.requestTimeoutMs = configService.get('FAKTUROWNIA_REQUEST_TIMEOUT_MS', {
      infer: true,
    });
    this.fetchFn = fetchFn;
  }

  async createInvoice(
    payload: FakturowniaInvoicePayload,
  ): Promise<FakturowniaInvoiceRaw> {
    const requestBody: FakturowniaCreateInvoiceRequest = {
      api_token: this.getApiToken(),
      invoice: payload,
    };

    return this.postInvoiceDocument(requestBody) as Promise<FakturowniaInvoiceRaw>;
  }

  async createOrder(
    payload: FakturowniaOrderPayload,
  ): Promise<FakturowniaOrderRaw> {
    const requestBody: FakturowniaCreateOrderRequest = {
      api_token: this.getApiToken(),
      invoice: payload,
    };

    return this.postInvoiceDocument(requestBody) as Promise<FakturowniaOrderRaw>;
  }

  private getApiToken(): string {
    this.assertConfigured();

    return this.apiToken!;
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new FakturowniaApiError({
        category: 'UNKNOWN',
        message: 'FAKTUROWNIA_BASE_URL is not configured',
      });
    }

    if (!this.apiToken) {
      throw new FakturowniaApiError({
        category: 'UNKNOWN',
        message: 'FAKTUROWNIA_API_TOKEN is not configured',
      });
    }
  }

  private async postInvoiceDocument(
    requestBody: FakturowniaDocumentRequest,
  ): Promise<unknown> {
    this.assertConfigured();

    const url = `${this.baseUrl!.replace(/\/$/, '')}/invoices.json`;

    const response = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    const body = await this.parseResponseBody(response);

    if (!response.ok) {
      const failure: FakturowniaHttpFailure = {
        httpStatus: response.status,
        body,
      };
      throw failure;
    }

    return body;
  }

  private async parseResponseBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
