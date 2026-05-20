import type { QueryResultRow } from 'pg';
import type { ClientConfigRow } from '../../persistence/client-config.persistence';

export function mapClientConfigRow(row: QueryResultRow): ClientConfigRow {
  return row as ClientConfigRow;
}
