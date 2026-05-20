import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { rethrowDatabaseError } from '../../../database/database.errors';
import { mapTechnicalRetryAttemptRow } from '../mappers/persistence/technical-retry-attempt.persistence-mapper';
import type {
  InsertTechnicalRetryAttemptParams,
  TechnicalRetryAttemptRow,
} from '../persistence/technical-retry-attempt.persistence';

@Injectable()
export class TechnicalRetryAttemptRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(
    params: InsertTechnicalRetryAttemptParams,
  ): Promise<TechnicalRetryAttemptRow> {
    try {
      const result = await this.databaseService.query(
        `
          INSERT INTO technical_retry_attempts (
            invoice_process_id,
            requested_by,
            reason,
            from_status,
            target_action,
            allowed,
            blocked_reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          params.invoice_process_id,
          params.requested_by,
          params.reason,
          params.from_status,
          params.target_action,
          params.allowed,
          params.blocked_reason ?? null,
        ],
      );

      return mapTechnicalRetryAttemptRow(result.rows[0]);
    } catch (error) {
      rethrowDatabaseError(error);
    }
  }
}
