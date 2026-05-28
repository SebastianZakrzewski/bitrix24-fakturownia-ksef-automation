import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapInvoiceProcessRow } from '../mappers/persistence/invoice-process.persistence-mapper';
import type {
  InsertInvoiceProcessParams,
  InvoiceProcessRow,
  UpdateInvoiceProcessStatusParams,
} from '../persistence/invoice-process.persistence';
import type { InvoiceType } from '../types/invoice.types';

@Injectable()
export class InvoiceProcessRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(params: InsertInvoiceProcessParams): Promise<InvoiceProcessRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO invoice_processes (
            bitrix_deal_id,
            invoice_type,
            status,
            idempotency_key,
            fakturownia_invoice_id,
            fakturownia_invoice_url,
            ksef_status,
            validation_errors,
            last_error_message
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          params.bitrix_deal_id,
          params.invoice_type,
          params.status,
          params.idempotency_key,
          params.fakturownia_invoice_id ?? null,
          params.fakturownia_invoice_url ?? null,
          params.ksef_status ?? null,
          params.validation_errors
            ? JSON.stringify(params.validation_errors)
            : null,
          params.last_error_message ?? null,
        ],
      );

      return mapInvoiceProcessRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }

  async findById(id: string): Promise<InvoiceProcessRow | null> {
    const result = await this.databaseService.query(
      `SELECT * FROM invoice_processes WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapInvoiceProcessRow(result.rows[0]);
  }

  async findByDealIdAndInvoiceType(
    bitrixDealId: string,
    invoiceType: InvoiceType,
  ): Promise<InvoiceProcessRow | null> {
    const result = await this.databaseService.query(
      `
        SELECT * FROM invoice_processes
        WHERE bitrix_deal_id = $1 AND invoice_type = $2
      `,
      [bitrixDealId, invoiceType],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapInvoiceProcessRow(result.rows[0]);
  }

  async updateStatus(
    id: string,
    params: UpdateInvoiceProcessStatusParams,
  ): Promise<InvoiceProcessRow | null> {
    try {
      const result = await this.databaseService.query(
        `
          UPDATE invoice_processes
          SET
            status = $2,
            last_error_message = $3,
            validation_errors = $4,
            ksef_status = COALESCE($5, ksef_status),
            ksef_last_checked_at = CASE
              WHEN $5 IS NOT NULL THEN now()
              ELSE ksef_last_checked_at
            END,
            updated_at = now()
          WHERE id = $1
          RETURNING *
        `,
        [
          id,
          params.status,
          params.last_error_message ?? null,
          params.validation_errors
            ? JSON.stringify(params.validation_errors)
            : null,
          params.ksef_status ?? null,
        ],
      );

      if (result.rowCount === 0) {
        return null;
      }

      return mapInvoiceProcessRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
