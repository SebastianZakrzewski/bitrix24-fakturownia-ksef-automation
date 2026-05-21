import { Injectable } from '@nestjs/common';
import { POSTGRES_UNIQUE_VIOLATION } from '../../../database/database.constants';
import { DatabaseConstraintError } from '../../../database/database.errors';
import { InvoiceCreationBlockedError } from '../errors/invoice-process.errors';
import { buildIdempotencyKey } from '../lifecycle/invoice-process.lifecycle';
import type { InvoiceProcessRow } from '../persistence/invoice-process.persistence';
import { InvoiceProcessRepository } from '../repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../repositories/invoice-record.repository';
import type { InvoiceType } from '../types/invoice.types';

@Injectable()
export class InvoiceIdempotencyService {
  constructor(
    private readonly invoiceProcessRepository: InvoiceProcessRepository,
    private readonly invoiceRecordRepository: InvoiceRecordRepository,
  ) {}

  async claim(
    bitrixDealId: string,
    invoiceType: InvoiceType,
  ): Promise<InvoiceProcessRow> {
    const existing =
      await this.invoiceProcessRepository.findByDealIdAndInvoiceType(
        bitrixDealId,
        invoiceType,
      );

    if (existing) {
      return existing;
    }

    try {
      return await this.invoiceProcessRepository.create({
        bitrix_deal_id: bitrixDealId,
        invoice_type: invoiceType,
        status: 'TRIGGER_RECEIVED',
        idempotency_key: buildIdempotencyKey(bitrixDealId, invoiceType),
      });
    } catch (error) {
      if (
        error instanceof DatabaseConstraintError &&
        error.code === POSTGRES_UNIQUE_VIOLATION
      ) {
        const raced =
          await this.invoiceProcessRepository.findByDealIdAndInvoiceType(
            bitrixDealId,
            invoiceType,
          );

        if (raced) {
          return raced;
        }
      }

      throw error;
    }
  }

  async assertCanCreateInvoice(invoiceProcessId: string): Promise<void> {
    const record =
      await this.invoiceRecordRepository.findByInvoiceProcessId(
        invoiceProcessId,
      );

    if (record) {
      throw new InvoiceCreationBlockedError(invoiceProcessId);
    }
  }
}
