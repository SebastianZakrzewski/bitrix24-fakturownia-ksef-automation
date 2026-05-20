import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapInvoiceRecordRow } from '../mappers/persistence/invoice-record.persistence-mapper';
import type {
  InsertInvoiceRecordParams,
  InvoiceRecordRow,
} from '../persistence/invoice-record.persistence';

@Injectable()
export class InvoiceRecordRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insert(params: InsertInvoiceRecordParams): Promise<InvoiceRecordRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO invoice_records (
            invoice_process_id,
            bitrix_deal_id,
            invoice_type,
            fakturownia_invoice_id,
            fakturownia_invoice_url,
            total_net,
            total_gross,
            vat_rate,
            currency
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          params.invoice_process_id,
          params.bitrix_deal_id,
          params.invoice_type,
          params.fakturownia_invoice_id,
          params.fakturownia_invoice_url,
          params.total_net,
          params.total_gross,
          params.vat_rate,
          params.currency,
        ],
      );

      return mapInvoiceRecordRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
