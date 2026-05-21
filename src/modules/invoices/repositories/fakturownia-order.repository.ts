import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapFakturowniaOrderRow } from '../mappers/persistence/fakturownia-order.persistence-mapper';
import type {
  FakturowniaOrderRow,
  InsertFakturowniaOrderParams,
} from '../persistence/fakturownia-order.persistence';

@Injectable()
export class FakturowniaOrderRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async insert(params: InsertFakturowniaOrderParams): Promise<FakturowniaOrderRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO fakturownia_orders (
            bitrix_deal_id,
            fakturownia_order_id,
            fakturownia_order_number,
            created_from_invoice_process_id
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [
          params.bitrix_deal_id,
          params.fakturownia_order_id,
          params.fakturownia_order_number ?? null,
          params.created_from_invoice_process_id ?? null,
        ],
      );

      return mapFakturowniaOrderRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }

  async findByBitrixDealId(bitrixDealId: string): Promise<FakturowniaOrderRow | null> {
    const result = await this.databaseService.query(
      `
        SELECT * FROM fakturownia_orders
        WHERE bitrix_deal_id = $1
        LIMIT 1
      `,
      [bitrixDealId],
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapFakturowniaOrderRow(result.rows[0]);
  }
}
