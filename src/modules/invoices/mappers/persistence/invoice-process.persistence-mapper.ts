import type { QueryResultRow } from 'pg';
import type { InvoiceProcessRow } from '../../persistence/invoice-process.persistence';

export function mapInvoiceProcessRow(row: QueryResultRow): InvoiceProcessRow {
  return row as InvoiceProcessRow;
}
