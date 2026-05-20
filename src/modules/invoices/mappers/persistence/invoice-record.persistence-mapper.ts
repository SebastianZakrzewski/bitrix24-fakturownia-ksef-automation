import type { QueryResultRow } from 'pg';
import type { InvoiceRecordRow } from '../../persistence/invoice-record.persistence';

export function mapInvoiceRecordRow(row: QueryResultRow): InvoiceRecordRow {
  return row as InvoiceRecordRow;
}
