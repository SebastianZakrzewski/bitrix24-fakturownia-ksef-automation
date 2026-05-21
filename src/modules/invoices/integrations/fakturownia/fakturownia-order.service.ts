import { Injectable } from '@nestjs/common';
import type { InvoiceDraft } from '../../types/invoice.types';
import { FakturowniaClient } from './fakturownia.client';
import { FakturowniaErrorMapper } from './fakturownia-error.mapper';
import { FakturowniaOrderMapper } from './fakturownia-order.mapper';
import type { FakturowniaCreateOrderResult } from './fakturownia.types';

@Injectable()
export class FakturowniaOrderService {
  constructor(
    private readonly client: FakturowniaClient,
    private readonly orderMapper: FakturowniaOrderMapper,
    private readonly errorMapper: FakturowniaErrorMapper,
  ) {}

  async createOrder(
    invoiceDraft: InvoiceDraft,
  ): Promise<FakturowniaCreateOrderResult> {
    const payload = this.orderMapper.toCreatePayload(invoiceDraft);

    try {
      const raw = await this.client.createOrder(payload);
      return this.orderMapper.toCreateResult(raw);
    } catch (error) {
      throw this.errorMapper.map(error);
    }
  }
}
