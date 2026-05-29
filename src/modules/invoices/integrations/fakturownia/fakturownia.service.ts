import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../../../config/env.validation';
import type { InvoiceDraft } from '../../types/invoice.types';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import {
  pollKsefGovStatusUntilTerminal,
} from './fakturownia-ksef-status.util';
import { FakturowniaInvoiceNumberService } from './fakturownia-invoice-number.service';
import { FakturowniaMapper } from './fakturownia.mapper';
import type {
  FakturowniaCreateInvoiceResult,
  FakturowniaInvoiceOrderLinkage,
} from './fakturownia.types';

@Injectable()
export class FakturowniaService {
  private readonly ksefStatusPollTimeoutMs: number;
  private readonly ksefStatusPollIntervalMs: number;

  constructor(
    private readonly client: FakturowniaClient,
    private readonly mapper: FakturowniaMapper,
    private readonly errorMapper: FakturowniaErrorMapper,
    private readonly invoiceNumberService: FakturowniaInvoiceNumberService,
    configService: ConfigService<AppEnv, true>,
  ) {
    this.ksefStatusPollTimeoutMs = configService.get(
      'FAKTUROWNIA_KSEF_STATUS_POLL_TIMEOUT_MS',
      { infer: true },
    );
    this.ksefStatusPollIntervalMs = configService.get(
      'FAKTUROWNIA_KSEF_STATUS_POLL_INTERVAL_MS',
      { infer: true },
    );
  }

  async downloadInvoicePdf(fakturowniaInvoiceId: string): Promise<Buffer> {
    try {
      return await this.client.downloadInvoicePdf(fakturowniaInvoiceId);
    } catch (error) {
      throw this.errorMapper.map(error);
    }
  }

  async createInvoice(
    invoiceDraft: InvoiceDraft,
    orderLinkage?: FakturowniaInvoiceOrderLinkage,
  ): Promise<FakturowniaCreateInvoiceResult> {
    const numberAssignment = await this.invoiceNumberService.allocate(
      invoiceDraft.invoiceType,
    );
    const payload = this.mapper.toCreatePayload(
      invoiceDraft,
      numberAssignment,
      orderLinkage,
    );

    try {
      const raw = await this.client.createInvoice(payload);
      const finalGovStatus = await this.resolveGovStatusAfterCreate(raw);
      return this.mapper.toCreateResult({
        ...raw,
        gov_status: finalGovStatus,
      });
    } catch (error) {
      throw this.errorMapper.map(error);
    }
  }

  private async resolveGovStatusAfterCreate(
    raw: Awaited<ReturnType<FakturowniaClient['createInvoice']>>,
  ): Promise<string | null | undefined> {
    const invoiceId = String(raw.id);

    return pollKsefGovStatusUntilTerminal(
      raw.gov_status,
      {
        pollTimeoutMs: this.ksefStatusPollTimeoutMs,
        pollIntervalMs: this.ksefStatusPollIntervalMs,
      },
      {
        getGovStatus: async () => {
          const statusRaw = await this.client.getInvoiceKsefStatus(invoiceId);
          return statusRaw.gov_status;
        },
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        now: () => Date.now(),
      },
    );
  }
}
