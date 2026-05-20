import type { QueryResultRow } from 'pg';
import type { PanelAdminUserRow } from '../persistence/panel-admin-user.persistence';

export function mapPanelAdminUserRow(row: QueryResultRow): PanelAdminUserRow {
  return row as PanelAdminUserRow;
}
