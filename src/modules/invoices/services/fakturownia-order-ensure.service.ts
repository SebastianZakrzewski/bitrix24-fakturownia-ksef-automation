import { Injectable } from '@nestjs/common';
import { POSTGRES_UNIQUE_VIOLATION } from '../../../database/database.constants';
import { DatabaseConstraintError } from '../../../database/database.errors';
import { FakturowniaOrderService } from '../integrations/fakturownia/fakturownia-order.service';
import type { FakturowniaOrderRow } from '../persistence/fakturownia-order.persistence';
import { FakturowniaOrderRepository } from '../repositories/fakturownia-order.repository';
import type { InvoiceDraft } from '../types/invoice.types';

export type EnsureFakturowniaOrderParams = {
  invoiceDraft: InvoiceDraft;
  invoiceProcessId?: string;
};

@Injectable()
export class FakturowniaOrderEnsureService {
  constructor(
    private readonly fakturowniaOrderRepository: FakturowniaOrderRepository,
    private readonly fakturowniaOrderService: FakturowniaOrderService,
  ) {}

  async ensureForDeal(
    params: EnsureFakturowniaOrderParams,
  ): Promise<FakturowniaOrderRow> {
    const { invoiceDraft, invoiceProcessId } = params;
    const bitrixDealId = invoiceDraft.bitrixDealId;

    const existing =
      await this.fakturowniaOrderRepository.findByBitrixDealId(bitrixDealId);

    if (existing) {
      return existing;
    }

    const providerResult =
      await this.fakturowniaOrderService.createOrder(invoiceDraft);

    try {
      return await this.fakturowniaOrderRepository.insert({
        bitrix_deal_id: bitrixDealId,
        fakturownia_order_id: providerResult.fakturowniaOrderId,
        fakturownia_order_number: providerResult.fakturowniaOrderNumber,
        created_from_invoice_process_id: invoiceProcessId,
      });
    } catch (error) {
      if (
        error instanceof DatabaseConstraintError &&
        error.code === POSTGRES_UNIQUE_VIOLATION
      ) {
        const raced =
          await this.fakturowniaOrderRepository.findByBitrixDealId(
            bitrixDealId,
          );

        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  }
}
