import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import { FakturowniaApiError } from './fakturownia.errors';
import {
  FAKTUROWNIA_HTTP_CLIENT,
  type FakturowniaFetchFn,
} from './fakturownia-http-client.token';
import type {
  FakturowniaCreateInvoiceRequest,
  FakturowniaCreateOrderRequest,
  FakturowniaDocumentRequest,
  FakturowniaHttpFailure,
  FakturowniaInvoiceKsefStatusRaw,
  FakturowniaInvoiceListItemRaw,
  FakturowniaInvoicePayload,
  FakturowniaInvoiceRaw,
  FakturowniaOrderPayload,
  FakturowniaOrderRaw,
} from './fakturownia.types';

const LIST_INVOICES_MAX_PAGES = 20;

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
    @Inject(FAKTUROWNIA_HTTP_CLIENT) fetchFn: FakturowniaFetchFn,
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

  async listInvoicesForIssueMonth(
    kind: 'vat' | 'advance' | 'final',
    yearMonth: string,
  ): Promise<FakturowniaInvoiceListItemRaw[]> {
    this.assertConfigured();

    const collected: FakturowniaInvoiceListItemRaw[] = [];

    for (let page = 1; page <= LIST_INVOICES_MAX_PAGES; page += 1) {
      const params = new URLSearchParams({
        api_token: this.getApiToken(),
        kind,
        per_page: '100',
        page: String(page),
      });
      const url = `${this.baseUrl!.replace(/\/$/, '')}/invoices.json?${params.toString()}`;

      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
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

      if (!Array.isArray(body) || body.length === 0) {
        break;
      }

      for (const invoice of body as FakturowniaInvoiceListItemRaw[]) {
        if (invoice.issue_date?.startsWith(yearMonth)) {
          collected.push(invoice);
        }
      }

      if (body.length < 100) {
        break;
      }
    }

    return collected;
  }

  async getInvoiceKsefStatus(
    invoiceId: string,
  ): Promise<FakturowniaInvoiceKsefStatusRaw> {
    this.assertConfigured();

    const params = new URLSearchParams({
      api_token: this.getApiToken(),
      'fields[invoice]': 'gov_status,gov_id',
    });
    const url = `${this.baseUrl!.replace(/\/$/, '')}/invoices/${encodeURIComponent(invoiceId)}.json?${params.toString()}`;

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
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

    return body as FakturowniaInvoiceKsefStatusRaw;
  }

  async downloadInvoicePdf(invoiceId: string): Promise<Buffer> {
    this.assertConfigured();

    const url = `${this.baseUrl!.replace(/\/$/, '')}/invoices/${encodeURIComponent(invoiceId)}.pdf?api_token=${encodeURIComponent(this.getApiToken())}`;

    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: {
        Accept: 'application/pdf',
      },
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      const body = await this.parseResponseBody(response);
      const failure: FakturowniaHttpFailure = {
        httpStatus: response.status,
        body,
      };
      throw failure;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
