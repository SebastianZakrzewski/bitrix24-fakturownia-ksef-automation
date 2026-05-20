import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapClientConfigRow } from '../mappers/persistence/client-config.persistence-mapper';
import type {
  ClientConfigRow,
  InsertClientConfigParams,
} from '../persistence/client-config.persistence';

@Injectable()
export class ClientConfigRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getActive(): Promise<ClientConfigRow | null> {
    const result = await this.databaseService.query(
      `
        SELECT * FROM client_configs
        WHERE is_active = true
        LIMIT 1
      `,
    );

    if (result.rowCount === 0) {
      return null;
    }

    return mapClientConfigRow(result.rows[0]);
  }

  async create(params: InsertClientConfigParams): Promise<ClientConfigRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO client_configs (
            name,
            bitrix_paid_stage_id,
            bitrix_field_mapping,
            invoice_type_mapping,
            default_vat_rate,
            default_currency,
            default_unit,
            is_active
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          params.name,
          params.bitrix_paid_stage_id,
          JSON.stringify(params.bitrix_field_mapping),
          JSON.stringify(params.invoice_type_mapping),
          params.default_vat_rate ?? 23,
          params.default_currency ?? 'PLN',
          params.default_unit ?? 'szt.',
          params.is_active ?? true,
        ],
      );

      return mapClientConfigRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
