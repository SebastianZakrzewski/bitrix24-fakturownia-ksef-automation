import { POSTGRES_UNIQUE_VIOLATION } from '../../../database/database.constants';
import { DatabaseConstraintError } from '../../../database/database.errors';
import { FakturowniaApiError } from '../integrations/fakturownia/fakturownia.errors';
import { FakturowniaOrderService } from '../integrations/fakturownia/fakturownia-order.service';
import {
  invoiceDraftAdvanceFixture,
  invoiceDraftFinalFixture,
} from '../integrations/fakturownia/testing/fakturownia.fixtures';
import type { FakturowniaOrderRow } from '../persistence/fakturownia-order.persistence';
import { FakturowniaOrderRepository } from '../repositories/fakturownia-order.repository';
import { FakturowniaOrderEnsureService } from './fakturownia-order-ensure.service';

const orderRow = (
  overrides: Partial<FakturowniaOrderRow> = {},
): FakturowniaOrderRow => ({
  id: 'order-row-uuid-1',
  bitrix_deal_id: '27000',
  fakturownia_order_id: '10042',
  fakturownia_order_number: 'ZAM/100/2026',
  created_from_invoice_process_id: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('FakturowniaOrderEnsureService', () => {
  let fakturowniaOrderRepository: jest.Mocked<
    Pick<FakturowniaOrderRepository, 'findByBitrixDealId' | 'insert'>
  >;
  let fakturowniaOrderService: jest.Mocked<
    Pick<FakturowniaOrderService, 'createOrder'>
  >;
  let service: FakturowniaOrderEnsureService;

  beforeEach(() => {
    fakturowniaOrderRepository = {
      findByBitrixDealId: jest.fn(),
      insert: jest.fn(),
    };
    fakturowniaOrderService = {
      createOrder: jest.fn(),
    };
    service = new FakturowniaOrderEnsureService(
      fakturowniaOrderRepository as unknown as FakturowniaOrderRepository,
      fakturowniaOrderService as unknown as FakturowniaOrderService,
    );
  });

  it('returns existing order without provider or insert calls', async () => {
    const existing = orderRow();
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(existing);

    const result = await service.ensureForDeal({
      invoiceDraft: invoiceDraftAdvanceFixture(),
    });

    expect(result).toEqual(existing);
    expect(fakturowniaOrderService.createOrder).not.toHaveBeenCalled();
    expect(fakturowniaOrderRepository.insert).not.toHaveBeenCalled();
  });

  it('creates provider order and persists row when missing', async () => {
    const draft = invoiceDraftAdvanceFixture();
    const persisted = orderRow({
      created_from_invoice_process_id: 'process-uuid-1',
    });

    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockResolvedValue({
      fakturowniaOrderId: '10042',
      fakturowniaOrderNumber: 'ZAM/100/2026',
    });
    fakturowniaOrderRepository.insert.mockResolvedValue(persisted);

    const result = await service.ensureForDeal({
      invoiceDraft: draft,
      invoiceProcessId: 'process-uuid-1',
    });

    expect(result).toEqual(persisted);
    expect(fakturowniaOrderService.createOrder).toHaveBeenCalledWith(draft);
    expect(fakturowniaOrderRepository.insert).toHaveBeenCalledWith({
      bitrix_deal_id: '27000',
      fakturownia_order_id: '10042',
      fakturownia_order_number: 'ZAM/100/2026',
      created_from_invoice_process_id: 'process-uuid-1',
    });
  });

  it('works for FINAL invoice drafts', async () => {
    const draft = invoiceDraftFinalFixture();
    const persisted = orderRow();

    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockResolvedValue({
      fakturowniaOrderId: '10042',
      fakturowniaOrderNumber: 'ZAM/100/2026',
    });
    fakturowniaOrderRepository.insert.mockResolvedValue(persisted);

    const result = await service.ensureForDeal({ invoiceDraft: draft });

    expect(result).toEqual(persisted);
    expect(fakturowniaOrderService.createOrder).toHaveBeenCalledWith(draft);
  });

  it('returns raced winner after unique violation on insert', async () => {
    const winner = orderRow({ id: 'winner-uuid' });

    fakturowniaOrderRepository.findByBitrixDealId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    fakturowniaOrderService.createOrder.mockResolvedValue({
      fakturowniaOrderId: '10042',
      fakturowniaOrderNumber: 'ZAM/100/2026',
    });
    fakturowniaOrderRepository.insert.mockRejectedValue(
      new DatabaseConstraintError(
        POSTGRES_UNIQUE_VIOLATION,
        'duplicate key',
      ),
    );

    const result = await service.ensureForDeal({
      invoiceDraft: invoiceDraftAdvanceFixture(),
    });

    expect(result).toEqual(winner);
    expect(fakturowniaOrderRepository.insert).toHaveBeenCalledTimes(1);
    expect(fakturowniaOrderRepository.findByBitrixDealId).toHaveBeenCalledTimes(
      2,
    );
  });

  it('rethrows unique violation when existing order cannot be loaded', async () => {
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockResolvedValue({
      fakturowniaOrderId: '10042',
    });
    fakturowniaOrderRepository.insert.mockRejectedValue(
      new DatabaseConstraintError(
        POSTGRES_UNIQUE_VIOLATION,
        'duplicate key',
      ),
    );

    await expect(
      service.ensureForDeal({ invoiceDraft: invoiceDraftAdvanceFixture() }),
    ).rejects.toThrow(DatabaseConstraintError);
  });

  it('propagates 4xx provider errors', async () => {
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockRejectedValue(
      new FakturowniaApiError({
        category: 'CLIENT',
        message: 'Invalid buyer tax number',
        httpStatus: 422,
      }),
    );

    await expect(
      service.ensureForDeal({ invoiceDraft: invoiceDraftAdvanceFixture() }),
    ).rejects.toMatchObject({
      category: 'CLIENT',
      httpStatus: 422,
    } satisfies Partial<FakturowniaApiError>);

    expect(fakturowniaOrderRepository.insert).not.toHaveBeenCalled();
  });

  it('propagates 5xx provider errors', async () => {
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockRejectedValue(
      new FakturowniaApiError({
        category: 'SERVER',
        message: 'Internal server error',
        httpStatus: 503,
      }),
    );

    await expect(
      service.ensureForDeal({ invoiceDraft: invoiceDraftAdvanceFixture() }),
    ).rejects.toMatchObject({
      category: 'SERVER',
      httpStatus: 503,
    } satisfies Partial<FakturowniaApiError>);
  });

  it('propagates timeout provider errors', async () => {
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockRejectedValue(
      new FakturowniaApiError({
        category: 'TIMEOUT',
        message: 'The operation was aborted',
      }),
    );

    await expect(
      service.ensureForDeal({ invoiceDraft: invoiceDraftAdvanceFixture() }),
    ).rejects.toMatchObject({
      category: 'TIMEOUT',
    } satisfies Partial<FakturowniaApiError>);
  });

  it('does not persist when provider order creation fails', async () => {
    fakturowniaOrderRepository.findByBitrixDealId.mockResolvedValue(null);
    fakturowniaOrderService.createOrder.mockRejectedValue(
      new FakturowniaApiError({
        category: 'UNKNOWN',
        message: 'Unexpected failure',
      }),
    );

    await expect(
      service.ensureForDeal({ invoiceDraft: invoiceDraftAdvanceFixture() }),
    ).rejects.toThrow(FakturowniaApiError);

    expect(fakturowniaOrderRepository.insert).not.toHaveBeenCalled();
  });
});
