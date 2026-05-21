import { Bitrix24CompanyService } from '../../bitrix24/services/bitrix24-company.service';
import { Bitrix24DealService } from '../../bitrix24/services/bitrix24-deal.service';
import { Bitrix24ProductRowService } from '../../bitrix24/services/bitrix24-product-row.service';
import type { BitrixDealData } from '../../bitrix24/types/bitrix24.types';
import { EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS } from '../config/evapremium-v1-client-config';
import type { CreateInvoiceFromBitrixDealCommand } from '../commands/create-invoice-from-bitrix-deal.command';
import { BitrixInvoiceMapper } from '../mappers/bitrix-invoice.mapper';
import type { ClientConfigRow } from '../persistence/client-config.persistence';
import type { InvoiceProcessRow } from '../persistence/invoice-process.persistence';
import { BitrixDealSnapshotRepository } from '../repositories/bitrix-deal-snapshot.repository';
import { ClientConfigRepository } from '../repositories/client-config.repository';
import { InvoiceEventRepository } from '../repositories/invoice-event.repository';
import { InvoiceProcessRepository } from '../repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../repositories/invoice-record.repository';
import { InvoiceIdempotencyService } from '../services/invoice-idempotency.service';
import { InvoiceProcessService } from '../services/invoice-process.service';
import { InvoiceValidationService } from '../services/invoice-validation.service';
import {
  bitrixCompanyNoNip,
  bitrixCompanyValidFixture,
  bitrixDealAdvanceWithAmount,
  bitrixDealEmptyProducts,
  bitrixDealForAdvance,
  bitrixDealForFinal,
  bitrixDealForFull,
  bitrixDealMissingInvoiceType,
  bitrixDealNoCompany,
  bitrixProductRowInvalidFixture,
} from '../testing/invoice-mapping.fixtures';
import type { InvoiceType } from '../types/invoice.types';
import { CreateInvoiceFromBitrixDealUseCase } from './create-invoice-from-bitrix-deal.use-case';

const command = (): CreateInvoiceFromBitrixDealCommand => ({
  bitrixDealId: '27000',
  triggerSource: 'BITRIX24_STAGE_CHANGE',
  triggerStageId: 'PREPARATION',
  triggeredAt: '2026-01-01T00:00:00.000Z',
});

const clientConfigRow = (): ClientConfigRow => ({
  id: 'config-uuid-1',
  name: 'Evapremium V1',
  bitrix_paid_stage_id: EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_paid_stage_id,
  bitrix_field_mapping: EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping,
  invoice_type_mapping: EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.invoice_type_mapping,
  default_vat_rate: 23,
  default_currency: 'PLN',
  default_unit: 'szt.',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

const processRow = (
  invoiceType: InvoiceType,
  overrides: Partial<InvoiceProcessRow> = {},
): InvoiceProcessRow => ({
  id: 'process-uuid-1',
  bitrix_deal_id: '27000',
  invoice_type: invoiceType,
  status: 'TRIGGER_RECEIVED',
  idempotency_key: `27000:${invoiceType}`,
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

const toDealCore = (deal: BitrixDealData) => ({
  dealId: deal.dealId,
  dealUrl: deal.dealUrl,
  stageId: deal.stageId,
  companyId: deal.companyId,
  customFields: deal.customFields,
});

describe('CreateInvoiceFromBitrixDealUseCase — validation failure path', () => {
  let useCase: CreateInvoiceFromBitrixDealUseCase;
  let clientConfigRepository: jest.Mocked<Pick<ClientConfigRepository, 'getActive'>>;
  let bitrix24DealService: jest.Mocked<Pick<Bitrix24DealService, 'getDealById'>>;
  let bitrix24CompanyService: jest.Mocked<
    Pick<Bitrix24CompanyService, 'getCompanyById'>
  >;
  let bitrix24ProductRowService: jest.Mocked<
    Pick<Bitrix24ProductRowService, 'listByDealId'>
  >;
  let invoiceIdempotencyService: jest.Mocked<Pick<InvoiceIdempotencyService, 'claim'>>;
  let invoiceProcessRepository: jest.Mocked<
    Pick<InvoiceProcessRepository, 'findByDealIdAndInvoiceType' | 'updateStatus'>
  >;
  let invoiceEventRepository: jest.Mocked<Pick<InvoiceEventRepository, 'insert'>>;
  let bitrixDealSnapshotRepository: jest.Mocked<
    Pick<BitrixDealSnapshotRepository, 'insert'>
  >;
  let invoiceRecordRepository: jest.Mocked<
    Pick<InvoiceRecordRepository, 'findByInvoiceProcessId' | 'insert'>
  >;

  const setupBitrixMocks = (
    deal: BitrixDealData,
    company: ReturnType<typeof bitrixCompanyValidFixture> | undefined,
  ) => {
    bitrix24DealService.getDealById.mockResolvedValue(toDealCore(deal));
    bitrix24ProductRowService.listByDealId.mockResolvedValue(deal.productRows);

    if (deal.companyId && company) {
      bitrix24CompanyService.getCompanyById.mockResolvedValue(company);
    }
  };

  beforeEach(() => {
    clientConfigRepository = { getActive: jest.fn() };
    bitrix24DealService = { getDealById: jest.fn() };
    bitrix24CompanyService = { getCompanyById: jest.fn() };
    bitrix24ProductRowService = { listByDealId: jest.fn() };
    invoiceIdempotencyService = { claim: jest.fn() };
    invoiceProcessRepository = {
      findByDealIdAndInvoiceType: jest.fn().mockResolvedValue(null),
      updateStatus: jest.fn(),
    };
    invoiceEventRepository = { insert: jest.fn() };
    bitrixDealSnapshotRepository = { insert: jest.fn().mockResolvedValue({}) };
    invoiceRecordRepository = {
      findByInvoiceProcessId: jest.fn().mockResolvedValue(null),
      insert: jest.fn(),
    };

    clientConfigRepository.getActive.mockResolvedValue(clientConfigRow());

    useCase = new CreateInvoiceFromBitrixDealUseCase(
      clientConfigRepository as unknown as ClientConfigRepository,
      bitrix24DealService as unknown as Bitrix24DealService,
      bitrix24CompanyService as unknown as Bitrix24CompanyService,
      bitrix24ProductRowService as unknown as Bitrix24ProductRowService,
      invoiceIdempotencyService as unknown as InvoiceIdempotencyService,
      new BitrixInvoiceMapper(),
      new InvoiceValidationService(),
      new InvoiceProcessService(),
      invoiceProcessRepository as unknown as InvoiceProcessRepository,
      invoiceEventRepository as unknown as InvoiceEventRepository,
      bitrixDealSnapshotRepository as unknown as BitrixDealSnapshotRepository,
      invoiceRecordRepository as unknown as InvoiceRecordRepository,
    );
  });

  const assertForbiddenSideEffects = () => {
    expect(invoiceRecordRepository.insert).not.toHaveBeenCalled();
  };

  const assertValidationFailurePersistence = (
    expectedCode: string,
    invoiceType: InvoiceType,
  ) => {
    expect(invoiceIdempotencyService.claim).toHaveBeenCalledWith('27000', invoiceType);
    expect(bitrixDealSnapshotRepository.insert).toHaveBeenCalledTimes(1);
    expect(invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
      'process-uuid-1',
      expect.objectContaining({
        status: 'VALIDATION_FAILED',
        validation_errors: expect.arrayContaining([
          expect.objectContaining({ code: expectedCode }),
        ]),
      }),
    );
    expect(invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_process_id: 'process-uuid-1',
        bitrix_deal_id: '27000',
        event_type: 'VALIDATION_FAILED',
      }),
    );
    assertForbiddenSideEffects();
  };

  it('returns VALIDATION_FAILED without process when invoice type cannot be resolved', async () => {
    const deal = bitrixDealMissingInvoiceType();
    setupBitrixMocks(deal, bitrixCompanyValidFixture());

    const result = await useCase.execute(command());

    expect(result).toEqual({
      status: 'VALIDATION_FAILED',
      bitrix_deal_id: '27000',
      message:
        'Invoice type is missing or could not be resolved from Bitrix deal fields.',
    });
    expect(result.process_id).toBeUndefined();
    expect(invoiceIdempotencyService.claim).not.toHaveBeenCalled();
    expect(bitrixDealSnapshotRepository.insert).not.toHaveBeenCalled();
    expect(invoiceProcessRepository.updateStatus).not.toHaveBeenCalled();
    expect(invoiceEventRepository.insert).not.toHaveBeenCalled();
    assertForbiddenSideEffects();
  });

  it('returns VALIDATION_FAILED when company is missing', async () => {
    const deal = bitrixDealNoCompany();
    setupBitrixMocks(deal, undefined);
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    expect(result.process_id).toBe('process-uuid-1');
    expect(result.invoice_type).toBe('FULL');
    assertValidationFailurePersistence('MISSING_COMPANY', 'FULL');
  });

  it('returns VALIDATION_FAILED when NIP is missing', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deal, bitrixCompanyNoNip());
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_NIP', 'FULL');
  });

  it('returns VALIDATION_FAILED when products are missing', async () => {
    const deal = bitrixDealEmptyProducts();
    setupBitrixMocks(deal, bitrixCompanyValidFixture());
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_PRODUCTS', 'FULL');
  });

  it('returns VALIDATION_FAILED when a product line is invalid', async () => {
    const deal = bitrixDealForFull();
    deal.productRows = bitrixProductRowInvalidFixture();
    setupBitrixMocks(deal, bitrixCompanyValidFixture());
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('INVALID_PRODUCT_LINE', 'FULL');
  });

  it.each([
    { label: 'zero', advanceAmount: '0' },
    { label: 'negative', advanceAmount: '-100' },
  ])(
    'returns VALIDATION_FAILED for ADVANCE with $label advance amount',
    async ({ advanceAmount }) => {
      const deal = bitrixDealAdvanceWithAmount(advanceAmount);
      setupBitrixMocks(deal, bitrixCompanyValidFixture());
      invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

      const result = await useCase.execute(command());

      expect(result.status).toBe('VALIDATION_FAILED');
      assertValidationFailurePersistence('INVALID_ADVANCE_AMOUNT', 'ADVANCE');
    },
  );

  it('returns VALIDATION_FAILED for FINAL without previous advance invoice', async () => {
    const deal = bitrixDealForFinal();
    setupBitrixMocks(deal, bitrixCompanyValidFixture());
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('FINAL'));
    invoiceProcessRepository.findByDealIdAndInvoiceType.mockResolvedValue(null);

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_PREVIOUS_ADVANCE_INVOICE', 'FINAL');
  });

  it('does not create InvoiceRecord on ADVANCE missing amount validation failure', async () => {
    const deal = bitrixDealForAdvance();
    delete (deal.customFields as Record<string, unknown>)[
      EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping.advanceAmountField
    ];
    setupBitrixMocks(deal, bitrixCompanyValidFixture());
    invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

    await useCase.execute(command());

    assertForbiddenSideEffects();
  });
});
