import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../../types/invoice.types';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaMapper } from './fakturownia.mapper';
import type {
  FakturowniaCreateInvoiceResult,
  FakturowniaInvoiceOrderLinkage,
} from './fakturownia.types';

@Injectable()
export class FakturowniaService {
  constructor(
    private readonly client: FakturowniaClient,
    private readonly mapper: FakturowniaMapper,
    private readonly errorMapper: FakturowniaErrorMapper,
  ) {}

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
    const payload = this.mapper.toCreatePayload(invoiceDraft, orderLinkage);

    try {
      const raw = await this.client.createInvoice(payload);
      return this.mapper.toCreateResult(raw);
    } catch (error) {
      throw this.errorMapper.map(error);
    }
  }
}
