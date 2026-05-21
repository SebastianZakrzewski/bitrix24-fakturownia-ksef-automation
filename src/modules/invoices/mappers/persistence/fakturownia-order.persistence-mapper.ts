import type { QueryResultRow } from 'pg';
import type { FakturowniaOrderRow } from '../../persistence/fakturownia-order.persistence';

export function mapFakturowniaOrderRow(row: QueryResultRow): FakturowniaOrderRow {
  return row as FakturowniaOrderRow;
}
