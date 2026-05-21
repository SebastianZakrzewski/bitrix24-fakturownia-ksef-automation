import { POSTGRES_UNIQUE_VIOLATION } from '../../../database/database.constants';
import { DatabaseConstraintError } from '../../../database/database.errors';
import { InvoiceCreationBlockedError } from '../errors/invoice-process.errors';
import type { InvoiceProcessRow } from '../persistence/invoice-process.persistence';
import type { InvoiceRecordRow } from '../persistence/invoice-record.persistence';
import { InvoiceProcessRepository } from '../repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../repositories/invoice-record.repository';
import { InvoiceIdempotencyService } from './invoice-idempotency.service';

const processRow = (overrides: Partial<InvoiceProcessRow> = {}): InvoiceProcessRow => ({
  id: 'process-uuid-1',
  bitrix_deal_id: 'deal-100',
  invoice_type: 'FULL',
  status: 'TRIGGER_RECEIVED',
  idempotency_key: 'deal-100:FULL',
  fakturownia_invoice_id: null,
  fakturownia_invoice_url: null,
  ksef_status: null,
  ksef_last_checked_at: null,
  validation_errors: null,
  last_error_message: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  completed_at: null,
  ...overrides,
});

const recordRow = (invoiceProcessId: string): InvoiceRecordRow => ({
  id: 'record-uuid-1',
  invoice_process_id: invoiceProcessId,
  bitrix_deal_id: 'deal-100',
  invoice_type: 'FULL',
  fakturownia_invoice_id: 'fakt-100',
  fakturownia_invoice_url: 'https://example.com/invoices/100',
  total_net: '100.00',
  total_gross: '123.00',
  vat_rate: 23,
  currency: 'PLN',
  created_at: '2026-01-01T00:00:00.000Z',
});

describe('InvoiceIdempotencyService', () => {
  let invoiceProcessRepository: jest.Mocked<
    Pick<
      InvoiceProcessRepository,
      'findByDealIdAndInvoiceType' | 'create'
    >
  >;
  let invoiceRecordRepository: jest.Mocked<
    Pick<InvoiceRecordRepository, 'findByInvoiceProcessId'>
  >;
  let service: InvoiceIdempotencyService;

  beforeEach(() => {
    invoiceProcessRepository = {
      findByDealIdAndInvoiceType: jest.fn(),
      create: jest.fn(),
    };
    invoiceRecordRepository = {
      findByInvoiceProcessId: jest.fn(),
    };
    service = new InvoiceIdempotencyService(
      invoiceProcessRepository as unknown as InvoiceProcessRepository,
      invoiceRecordRepository as unknown as InvoiceRecordRepository,
    );
  });

  describe('claim', () => {
    it('creates process when none exists', async () => {
      const created = processRow();
      invoiceProcessRepository.findByDealIdAndInvoiceType.mockResolvedValue(null);
      invoiceProcessRepository.create.mockResolvedValue(created);

      const result = await service.claim('deal-100', 'FULL');

      expect(result).toEqual(created);
      expect(invoiceProcessRepository.create).toHaveBeenCalledWith({
        bitrix_deal_id: 'deal-100',
        invoice_type: 'FULL',
        status: 'TRIGGER_RECEIVED',
        idempotency_key: 'deal-100:FULL',
      });
    });

    it('returns existing process without create on duplicate claim', async () => {
      const existing = processRow();
      invoiceProcessRepository.findByDealIdAndInvoiceType.mockResolvedValue(
        existing,
      );

      const result = await service.claim('deal-100', 'FULL');

      expect(result).toEqual(existing);
      expect(invoiceProcessRepository.create).not.toHaveBeenCalled();
    });

    it('returns raced winner after unique violation on create', async () => {
      const winner = processRow({ id: 'winner-uuid' });
      invoiceProcessRepository.findByDealIdAndInvoiceType
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(winner);
      invoiceProcessRepository.create.mockRejectedValue(
        new DatabaseConstraintError(
          POSTGRES_UNIQUE_VIOLATION,
          'duplicate key',
        ),
      );

      const result = await service.claim('deal-100', 'FULL');

      expect(result).toEqual(winner);
      expect(invoiceProcessRepository.create).toHaveBeenCalledTimes(1);
      expect(invoiceProcessRepository.findByDealIdAndInvoiceType).toHaveBeenCalledTimes(
        2,
      );
    });

    it('rethrows unique violation when existing process cannot be loaded', async () => {
      invoiceProcessRepository.findByDealIdAndInvoiceType.mockResolvedValue(null);
      invoiceProcessRepository.create.mockRejectedValue(
        new DatabaseConstraintError(
          POSTGRES_UNIQUE_VIOLATION,
          'duplicate key',
        ),
      );

      await expect(service.claim('deal-100', 'FULL')).rejects.toThrow(
        DatabaseConstraintError,
      );
    });
  });

  describe('assertCanCreateInvoice', () => {
    it('passes when no invoice record exists', async () => {
      invoiceRecordRepository.findByInvoiceProcessId.mockResolvedValue(null);

      await expect(
        service.assertCanCreateInvoice('process-uuid-1'),
      ).resolves.toBeUndefined();
    });

    it('throws InvoiceCreationBlockedError when invoice record exists', async () => {
      invoiceRecordRepository.findByInvoiceProcessId.mockResolvedValue(
        recordRow('process-uuid-1'),
      );

      await expect(
        service.assertCanCreateInvoice('process-uuid-1'),
      ).rejects.toThrow(InvoiceCreationBlockedError);
    });
  });
});
