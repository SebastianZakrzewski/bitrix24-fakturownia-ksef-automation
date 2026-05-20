import type { QueryResultRow } from 'pg';
import type { TechnicalRetryAttemptRow } from '../../persistence/technical-retry-attempt.persistence';

export function mapTechnicalRetryAttemptRow(
  row: QueryResultRow,
): TechnicalRetryAttemptRow {
  return row as TechnicalRetryAttemptRow;
}
