import type { QueryResultRow } from 'pg';
import type { BitrixDealSnapshotRow } from '../../persistence/bitrix-deal-snapshot.persistence';

export function mapBitrixDealSnapshotRow(row: QueryResultRow): BitrixDealSnapshotRow {
  return row as BitrixDealSnapshotRow;
}
