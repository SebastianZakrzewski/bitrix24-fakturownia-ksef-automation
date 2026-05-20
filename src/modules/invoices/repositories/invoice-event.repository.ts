import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapInvoiceEventRow } from '../mappers/persistence/invoice-event.persistence-mapper';
import type {
  InsertInvoiceEventParams,
  InvoiceEventRow,
} from '../persistence/invoice-event.persistence';

@Injectable()
export class InvoiceEventRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insert(params: InsertInvoiceEventParams): Promise<InvoiceEventRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO invoice_events (
            invoice_process_id,
            bitrix_deal_id,
            event_type,
            message,
            metadata
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
        [
          params.invoice_process_id ?? null,
          params.bitrix_deal_id ?? null,
          params.event_type,
          params.message,
          params.metadata ? JSON.stringify(params.metadata) : null,
        ],
      );

      return mapInvoiceEventRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
