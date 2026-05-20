import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapBitrixDealSnapshotRow } from '../mappers/persistence/bitrix-deal-snapshot.persistence-mapper';
import type {
  BitrixDealSnapshotRow,
  InsertBitrixDealSnapshotParams,
} from '../persistence/bitrix-deal-snapshot.persistence';

@Injectable()
export class BitrixDealSnapshotRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insert(params: InsertBitrixDealSnapshotParams): Promise<BitrixDealSnapshotRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO bitrix_deal_snapshots (
            invoice_process_id,
            bitrix_deal_id,
            bitrix_company_id,
            raw_deal,
            raw_company,
            raw_product_rows,
            extracted_invoice_type,
            extracted_advance_amount,
            extracted_products
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          params.invoice_process_id,
          params.bitrix_deal_id,
          params.bitrix_company_id ?? null,
          JSON.stringify(params.raw_deal),
          params.raw_company ? JSON.stringify(params.raw_company) : null,
          params.raw_product_rows
            ? JSON.stringify(params.raw_product_rows)
            : null,
          params.extracted_invoice_type ?? null,
          params.extracted_advance_amount ?? null,
          params.extracted_products
            ? JSON.stringify(params.extracted_products)
            : null,
        ],
      );

      return mapBitrixDealSnapshotRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
