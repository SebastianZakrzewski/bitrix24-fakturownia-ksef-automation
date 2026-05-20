import type { InsertInvoiceProcessParams } from '../../src/modules/invoices/persistence/invoice-process.persistence';
import type { InsertInvoiceRecordParams } from '../../src/modules/invoices/persistence/invoice-record.persistence';
import type { InsertClientConfigParams } from '../../src/modules/invoices/persistence/client-config.persistence';

export const validInvoiceProcessParams = (): InsertInvoiceProcessParams => ({
  bitrix_deal_id: 'deal-100',
  invoice_type: 'FULL',
  status: 'TRIGGER_RECEIVED',
  idempotency_key: 'deal-100:FULL',
});

export const validInvoiceRecordParams = (
  invoiceProcessId: string,
  overrides: Partial<InsertInvoiceRecordParams> = {},
): InsertInvoiceRecordParams => ({
  invoice_process_id: invoiceProcessId,
  bitrix_deal_id: 'deal-100',
  invoice_type: 'FULL',
  fakturownia_invoice_id: 'fakt-100',
  fakturownia_invoice_url: 'https://example.com/invoices/100',
  total_net: '100.00',
  total_gross: '123.00',
  vat_rate: 23,
  currency: 'PLN',
  ...overrides,
});

export const validClientConfigParams = (
  overrides: Partial<InsertClientConfigParams> = {},
): InsertClientConfigParams => ({
  name: 'Evapremium V1',
  bitrix_paid_stage_id: 'PAID',
  bitrix_field_mapping: { invoiceTypeField: 'UF_INVOICE_TYPE' },
  invoice_type_mapping: { FULL: 'full' },
  ...overrides,
});
