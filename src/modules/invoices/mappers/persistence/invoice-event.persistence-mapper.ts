import type { QueryResultRow } from 'pg';
import type { InvoiceEventRow } from '../../persistence/invoice-event.persistence';

export function mapInvoiceEventRow(row: QueryResultRow): InvoiceEventRow {
  return row as InvoiceEventRow;
}
