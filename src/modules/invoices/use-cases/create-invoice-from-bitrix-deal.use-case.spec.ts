import { Bitrix24CompanyService } from '../../bitrix24/services/bitrix24-company.service';
import { Bitrix24DealService } from '../../bitrix24/services/bitrix24-deal.service';
import { Bitrix24ProductRowService } from '../../bitrix24/services/bitrix24-product-row.service';
import type { BitrixDealData } from '../../bitrix24/types/bitrix24.types';
import { EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS } from '../config/evapremium-v1-client-config';
import type { CreateInvoiceFromBitrixDealCommand } from '../commands/create-invoice-from-bitrix-deal.command';
import { InvoiceCreationBlockedError } from '../errors/invoice-process.errors';
import { FakturowniaApiError } from '../integrations/fakturownia/fakturownia.errors';
import { FakturowniaService } from '../integrations/fakturownia/fakturownia.service';
import {
  fakturowniaInvoiceOrderLinkageFixture,
} from '../integrations/fakturownia/testing/fakturownia.fixtures';
import { BitrixInvoiceMapper } from '../mappers/bitrix-invoice.mapper';
import type { ClientConfigRow } from '../persistence/client-config.persistence';
import type { FakturowniaOrderRow } from '../persistence/fakturownia-order.persistence';
import type { InvoiceProcessRow } from '../persistence/invoice-process.persistence';
import type { InvoiceRecordRow } from '../persistence/invoice-record.persistence';
import { BitrixDealSnapshotRepository } from '../repositories/bitrix-deal-snapshot.repository';
import { ClientConfigRepository } from '../repositories/client-config.repository';
import { InvoiceEventRepository } from '../repositories/invoice-event.repository';
import { InvoiceProcessRepository } from '../repositories/invoice-process.repository';
import { InvoiceRecordRepository } from '../repositories/invoice-record.repository';
import { FakturowniaOrderEnsureService } from '../services/fakturownia-order-ensure.service';
import { InvoiceDraftBuilderService } from '../services/invoice-draft-builder.service';
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
import type { InvoiceProcessStatus, InvoiceType } from '../types/invoice.types';
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

const orderRow = (
  overrides: Partial<FakturowniaOrderRow> = {},
): FakturowniaOrderRow => ({
  id: 'order-row-uuid-1',
  bitrix_deal_id: '27000',
  fakturownia_order_id: '10042',
  fakturownia_order_number: 'ZAM/100/2026',
  created_from_invoice_process_id: 'process-uuid-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const fakturowniaCreateResult = () => ({
  fakturowniaInvoiceId: '987654',
  fakturowniaInvoiceUrl: 'https://evapremium.fakturownia.pl/invoices/987654',
  totalNet: 7747.97,
  totalGross: 9500,
  currency: 'PLN' as const,
});

const toDealCore = (deal: BitrixDealData) => ({
  dealId: deal.dealId,
  dealUrl: deal.dealUrl,
  stageId: deal.stageId,
  companyId: deal.companyId,
  customFields: deal.customFields,
});

type UseCaseDeps = {
  clientConfigRepository: jest.Mocked<Pick<ClientConfigRepository, 'getActive'>>;
  bitrix24DealService: jest.Mocked<Pick<Bitrix24DealService, 'getDealById'>>;
  bitrix24CompanyService: jest.Mocked<Pick<Bitrix24CompanyService, 'getCompanyById'>>;
  bitrix24ProductRowService: jest.Mocked<
    Pick<Bitrix24ProductRowService, 'listByDealId'>
  >;
  invoiceIdempotencyService: jest.Mocked<
    Pick<InvoiceIdempotencyService, 'claim' | 'assertCanCreateInvoice'>
  >;
  invoiceProcessRepository: jest.Mocked<
    Pick<InvoiceProcessRepository, 'findByDealIdAndInvoiceType' | 'updateStatus'>
  >;
  invoiceEventRepository: jest.Mocked<Pick<InvoiceEventRepository, 'insert'>>;
  bitrixDealSnapshotRepository: jest.Mocked<
    Pick<BitrixDealSnapshotRepository, 'insert'>
  >;
  invoiceRecordRepository: jest.Mocked<
    Pick<InvoiceRecordRepository, 'findByInvoiceProcessId' | 'insert'>
  >;
  fakturowniaOrderEnsureService: jest.Mocked<
    Pick<FakturowniaOrderEnsureService, 'ensureForDeal'>
  >;
  fakturowniaService: jest.Mocked<Pick<FakturowniaService, 'createInvoice'>>;
};

const createDeps = (): UseCaseDeps => ({
  clientConfigRepository: { getActive: jest.fn() },
  bitrix24DealService: { getDealById: jest.fn() },
  bitrix24CompanyService: { getCompanyById: jest.fn() },
  bitrix24ProductRowService: { listByDealId: jest.fn() },
  invoiceIdempotencyService: {
    claim: jest.fn(),
    assertCanCreateInvoice: jest.fn().mockResolvedValue(undefined),
  },
  invoiceProcessRepository: {
    findByDealIdAndInvoiceType: jest.fn().mockResolvedValue(null),
    updateStatus: jest.fn(),
  },
  invoiceEventRepository: { insert: jest.fn() },
  bitrixDealSnapshotRepository: { insert: jest.fn().mockResolvedValue({}) },
  invoiceRecordRepository: {
    findByInvoiceProcessId: jest.fn().mockResolvedValue(null),
    insert: jest.fn(),
  },
  fakturowniaOrderEnsureService: {
    ensureForDeal: jest.fn().mockResolvedValue(orderRow()),
  },
  fakturowniaService: {
    createInvoice: jest.fn().mockResolvedValue(fakturowniaCreateResult()),
  },
});

const createUseCase = (deps: UseCaseDeps) =>
  new CreateInvoiceFromBitrixDealUseCase(
    deps.clientConfigRepository as unknown as ClientConfigRepository,
    deps.bitrix24DealService as unknown as Bitrix24DealService,
    deps.bitrix24CompanyService as unknown as Bitrix24CompanyService,
    deps.bitrix24ProductRowService as unknown as Bitrix24ProductRowService,
    deps.invoiceIdempotencyService as unknown as InvoiceIdempotencyService,
    new BitrixInvoiceMapper(),
    new InvoiceValidationService(),
    new InvoiceProcessService(),
    deps.invoiceProcessRepository as unknown as InvoiceProcessRepository,
    deps.invoiceEventRepository as unknown as InvoiceEventRepository,
    deps.bitrixDealSnapshotRepository as unknown as BitrixDealSnapshotRepository,
    deps.invoiceRecordRepository as unknown as InvoiceRecordRepository,
    new InvoiceDraftBuilderService(),
    deps.fakturowniaOrderEnsureService as unknown as FakturowniaOrderEnsureService,
    deps.fakturowniaService as unknown as FakturowniaService,
  );

const setupBitrixMocks = (
  deps: UseCaseDeps,
  deal: BitrixDealData,
  company: ReturnType<typeof bitrixCompanyValidFixture> | undefined,
) => {
  deps.clientConfigRepository.getActive.mockResolvedValue(clientConfigRow());
  deps.bitrix24DealService.getDealById.mockResolvedValue(toDealCore(deal));
  deps.bitrix24ProductRowService.listByDealId.mockResolvedValue(deal.productRows);

  if (deal.companyId && company) {
    deps.bitrix24CompanyService.getCompanyById.mockResolvedValue(company);
  }
};

describe('CreateInvoiceFromBitrixDealUseCase — validation failure path', () => {
  let deps: UseCaseDeps;
  let useCase: CreateInvoiceFromBitrixDealUseCase;

  beforeEach(() => {
    deps = createDeps();
    useCase = createUseCase(deps);
  });

  const assertForbiddenSideEffects = () => {
    expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
    expect(deps.fakturowniaService.createInvoice).not.toHaveBeenCalled();
    expect(deps.fakturowniaOrderEnsureService.ensureForDeal).not.toHaveBeenCalled();
  };

  const assertValidationFailurePersistence = (
    expectedCode: string,
    invoiceType: InvoiceType,
  ) => {
    expect(deps.invoiceIdempotencyService.claim).toHaveBeenCalledWith(
      '27000',
      invoiceType,
    );
    expect(deps.bitrixDealSnapshotRepository.insert).toHaveBeenCalledTimes(1);
    expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
      'process-uuid-1',
      expect.objectContaining({
        status: 'VALIDATION_FAILED',
        validation_errors: expect.arrayContaining([
          expect.objectContaining({ code: expectedCode }),
        ]),
      }),
    );
    expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_process_id: 'process-uuid-1',
        bitrix_deal_id: '27000',
        event_type: 'VALIDATION_FAILED',
      }),
    );
    assertForbiddenSideEffects();
  };

  describe('forbidden side effects — Fakturownia', () => {
    it('does not call Fakturownia on validation failure paths', async () => {
      const deal = bitrixDealNoCompany();
      setupBitrixMocks(deps, deal, undefined);
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

      await useCase.execute(command());

      assertForbiddenSideEffects();
    });
  });

  describe('existing process short-circuit', () => {
    it.each<InvoiceProcessStatus>([
      'VALIDATION_FAILED',
      'UNKNOWN_AFTER_TIMEOUT',
      'COMPLETED',
    ])(
      'returns existing status without persistence side effects when process is %s',
      async (status) => {
        const deal = bitrixDealForFull();
        setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
        deps.invoiceIdempotencyService.claim.mockResolvedValue(
          processRow('FULL', { status }),
        );

        const result = await useCase.execute(command());

        expect(result).toEqual({
          process_id: 'process-uuid-1',
          status,
          bitrix_deal_id: '27000',
          invoice_type: 'FULL',
          message: `Invoice process already exists with status ${status}.`,
        });
        expect(deps.bitrixDealSnapshotRepository.insert).not.toHaveBeenCalled();
        expect(deps.invoiceProcessRepository.updateStatus).not.toHaveBeenCalled();
        expect(deps.invoiceEventRepository.insert).not.toHaveBeenCalled();
        assertForbiddenSideEffects();
      },
    );
  });

  it('returns VALIDATION_FAILED without process when invoice type cannot be resolved', async () => {
    const deal = bitrixDealMissingInvoiceType();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());

    const result = await useCase.execute(command());

    expect(result).toEqual({
      status: 'VALIDATION_FAILED',
      bitrix_deal_id: '27000',
      message:
        'Invoice type is missing or could not be resolved from Bitrix deal fields.',
    });
    expect(result.process_id).toBeUndefined();
    expect(deps.invoiceIdempotencyService.claim).not.toHaveBeenCalled();
    expect(deps.bitrixDealSnapshotRepository.insert).not.toHaveBeenCalled();
    expect(deps.invoiceProcessRepository.updateStatus).not.toHaveBeenCalled();
    expect(deps.invoiceEventRepository.insert).not.toHaveBeenCalled();
    assertForbiddenSideEffects();
  });

  it('returns VALIDATION_FAILED when company is missing', async () => {
    const deal = bitrixDealNoCompany();
    setupBitrixMocks(deps, deal, undefined);
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    expect(result.process_id).toBe('process-uuid-1');
    expect(result.invoice_type).toBe('FULL');
    assertValidationFailurePersistence('MISSING_COMPANY', 'FULL');
  });

  it('returns VALIDATION_FAILED when NIP is missing', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyNoNip());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_NIP', 'FULL');
  });

  it('returns VALIDATION_FAILED when products are missing', async () => {
    const deal = bitrixDealEmptyProducts();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_PRODUCTS', 'FULL');
  });

  it('returns VALIDATION_FAILED when a product line is invalid', async () => {
    const deal = bitrixDealForFull();
    deal.productRows = bitrixProductRowInvalidFixture();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

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
      setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

      const result = await useCase.execute(command());

      expect(result.status).toBe('VALIDATION_FAILED');
      assertValidationFailurePersistence('INVALID_ADVANCE_AMOUNT', 'ADVANCE');
    },
  );

  it('returns VALIDATION_FAILED for FINAL without previous advance invoice', async () => {
    const deal = bitrixDealForFinal();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FINAL'));
    deps.invoiceProcessRepository.findByDealIdAndInvoiceType.mockResolvedValue(null);

    const result = await useCase.execute(command());

    expect(result.status).toBe('VALIDATION_FAILED');
    assertValidationFailurePersistence('MISSING_PREVIOUS_ADVANCE_INVOICE', 'FINAL');
  });

  it('does not create InvoiceRecord on ADVANCE missing amount validation failure', async () => {
    const deal = bitrixDealForAdvance();
    delete (deal.customFields as Record<string, unknown>)[
      EVAPREMIUM_V1_CLIENT_CONFIG_MAPPINGS.bitrix_field_mapping.advanceAmountField
    ];
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

    await useCase.execute(command());

    assertForbiddenSideEffects();
  });
});

describe('CreateInvoiceFromBitrixDealUseCase — successful invoice creation path', () => {
  let deps: UseCaseDeps;
  let useCase: CreateInvoiceFromBitrixDealUseCase;

  beforeEach(() => {
    deps = createDeps();
    useCase = createUseCase(deps);
  });

  it('creates FULL invoice without order ensure', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('INVOICE_CREATED');
    expect(deps.fakturowniaOrderEnsureService.ensureForDeal).not.toHaveBeenCalled();
    expect(deps.fakturowniaService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceType: 'FULL', bitrixDealId: '27000' }),
      undefined,
    );
    expect(deps.invoiceRecordRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_process_id: 'process-uuid-1',
        fakturownia_invoice_id: '987654',
        fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/987654',
      }),
    );
    expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
      'process-uuid-1',
      expect.objectContaining({ status: 'INVOICE_CREATION_IN_PROGRESS' }),
    );
    expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
      'process-uuid-1',
      expect.objectContaining({ status: 'INVOICE_CREATED' }),
    );
    expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'INVOICE_CREATION_IN_PROGRESS' }),
    );
    expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'INVOICE_CREATED' }),
    );
  });

  it('creates ADVANCE invoice with order ensure and copy_invoice_from linkage', async () => {
    const deal = bitrixDealForAdvance();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

    const result = await useCase.execute(command());

    expect(result.status).toBe('INVOICE_CREATED');
    expect(deps.fakturowniaOrderEnsureService.ensureForDeal).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceProcessId: 'process-uuid-1',
        invoiceDraft: expect.objectContaining({ invoiceType: 'ADVANCE' }),
      }),
    );
    expect(deps.fakturowniaService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceType: 'ADVANCE' }),
      fakturowniaInvoiceOrderLinkageFixture(),
    );
  });

  it('creates FINAL invoice with order ensure and previous advance invoice id', async () => {
    const deal = bitrixDealForFinal();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FINAL'));

    const advanceProcess = processRow('ADVANCE', { id: 'advance-process-uuid' });
    const advanceRecord: InvoiceRecordRow = {
      id: 'record-advance-uuid',
      invoice_process_id: 'advance-process-uuid',
      bitrix_deal_id: '27000',
      invoice_type: 'ADVANCE',
      fakturownia_invoice_id: '2432393',
      fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/2432393',
      total_net: '3000',
      total_gross: '3690',
      vat_rate: 23,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    deps.invoiceProcessRepository.findByDealIdAndInvoiceType.mockImplementation(
      async (_dealId, type) => (type === 'ADVANCE' ? advanceProcess : null),
    );
    deps.invoiceRecordRepository.findByInvoiceProcessId.mockImplementation(
      async (processId) =>
        processId === 'advance-process-uuid' ? advanceRecord : null,
    );

    const result = await useCase.execute(command());

    expect(result.status).toBe('INVOICE_CREATED');
    expect(deps.fakturowniaOrderEnsureService.ensureForDeal).toHaveBeenCalled();
    expect(deps.fakturowniaService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceType: 'FINAL',
        previousAdvanceInvoiceId: '2432393',
      }),
      fakturowniaInvoiceOrderLinkageFixture(),
    );
  });

  it('sets INVOICE_CREATION_IN_PROGRESS before ensureForDeal for ADVANCE', async () => {
    const deal = bitrixDealForAdvance();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));

    const callOrder: string[] = [];

    deps.invoiceProcessRepository.updateStatus.mockImplementation(async (_id, params) => {
      if (params.status === 'INVOICE_CREATION_IN_PROGRESS') {
        callOrder.push('updateStatus:INVOICE_CREATION_IN_PROGRESS');
      }
      return processRow('ADVANCE', { status: params.status });
    });
    deps.fakturowniaOrderEnsureService.ensureForDeal.mockImplementation(async () => {
      callOrder.push('ensureForDeal');
      return orderRow();
    });
    deps.fakturowniaService.createInvoice.mockImplementation(async () => {
      callOrder.push('createInvoice');
      return fakturowniaCreateResult();
    });

    await useCase.execute(command());

    expect(callOrder).toEqual([
      'updateStatus:INVOICE_CREATION_IN_PROGRESS',
      'ensureForDeal',
      'createInvoice',
    ]);
  });

  it('sets INVOICE_CREATION_IN_PROGRESS before ensureForDeal for FINAL', async () => {
    const deal = bitrixDealForFinal();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FINAL'));

    const advanceProcess = processRow('ADVANCE', { id: 'advance-process-uuid' });
    const advanceRecord: InvoiceRecordRow = {
      id: 'record-advance-uuid',
      invoice_process_id: 'advance-process-uuid',
      bitrix_deal_id: '27000',
      invoice_type: 'ADVANCE',
      fakturownia_invoice_id: '2432393',
      fakturownia_invoice_url: 'https://evapremium.fakturownia.pl/invoices/2432393',
      total_net: '3000',
      total_gross: '3690',
      vat_rate: 23,
      currency: 'PLN',
      created_at: '2026-01-01T00:00:00.000Z',
    };

    deps.invoiceProcessRepository.findByDealIdAndInvoiceType.mockImplementation(
      async (_dealId, type) => (type === 'ADVANCE' ? advanceProcess : null),
    );
    deps.invoiceRecordRepository.findByInvoiceProcessId.mockImplementation(
      async (processId) =>
        processId === 'advance-process-uuid' ? advanceRecord : null,
    );

    const callOrder: string[] = [];

    deps.invoiceProcessRepository.updateStatus.mockImplementation(async (_id, params) => {
      if (params.status === 'INVOICE_CREATION_IN_PROGRESS') {
        callOrder.push('updateStatus:INVOICE_CREATION_IN_PROGRESS');
      }
      return processRow('FINAL', { status: params.status });
    });
    deps.fakturowniaOrderEnsureService.ensureForDeal.mockImplementation(async () => {
      callOrder.push('ensureForDeal');
      return orderRow();
    });
    deps.fakturowniaService.createInvoice.mockImplementation(async () => {
      callOrder.push('createInvoice');
      return fakturowniaCreateResult();
    });

    await useCase.execute(command());

    expect(callOrder).toEqual([
      'updateStatus:INVOICE_CREATION_IN_PROGRESS',
      'ensureForDeal',
      'createInvoice',
    ]);
  });

  it('does not call Fakturownia before validation, idempotency check, and status update', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const callOrder: string[] = [];

    deps.invoiceIdempotencyService.assertCanCreateInvoice.mockImplementation(async () => {
      callOrder.push('assertCanCreateInvoice');
    });
    deps.invoiceProcessRepository.updateStatus.mockImplementation(async (_id, params) => {
      if (params.status === 'INVOICE_CREATION_IN_PROGRESS') {
        callOrder.push('updateStatus:INVOICE_CREATION_IN_PROGRESS');
      }
      return processRow('FULL', { status: params.status });
    });
    deps.fakturowniaService.createInvoice.mockImplementation(async () => {
      callOrder.push('createInvoice');
      return fakturowniaCreateResult();
    });

    await useCase.execute(command());

    expect(callOrder).toEqual([
      'assertCanCreateInvoice',
      'updateStatus:INVOICE_CREATION_IN_PROGRESS',
      'createInvoice',
    ]);
  });

  it('persists InvoiceRecord only after provider success', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    const callOrder: string[] = [];

    deps.fakturowniaService.createInvoice.mockImplementation(async () => {
      callOrder.push('createInvoice');
      return fakturowniaCreateResult();
    });
    deps.invoiceRecordRepository.insert.mockImplementation(async (params) => {
      callOrder.push('insertInvoiceRecord');
      return {
        id: 'record-uuid-1',
        ...params,
        total_net: params.total_net,
        total_gross: params.total_gross,
        created_at: '2026-01-01T00:00:00.000Z',
      };
    });

    await useCase.execute(command());

    expect(callOrder).toEqual(['createInvoice', 'insertInvoiceRecord']);
    expect(deps.invoiceRecordRepository.insert).toHaveBeenCalledTimes(1);
  });

  it('blocks Fakturownia call when InvoiceRecord already exists', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));
    deps.invoiceIdempotencyService.assertCanCreateInvoice.mockRejectedValue(
      new InvoiceCreationBlockedError('process-uuid-1'),
    );

    const result = await useCase.execute(command());

    expect(result.status).toBe('TRIGGER_RECEIVED');
    expect(deps.fakturowniaService.createInvoice).not.toHaveBeenCalled();
    expect(deps.fakturowniaOrderEnsureService.ensureForDeal).not.toHaveBeenCalled();
    expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
  });

  it.each([
    { category: 'CLIENT' as const, httpStatus: 422 },
    { category: 'SERVER' as const, httpStatus: 503 },
  ])(
    'maps Fakturownia $category error to FAKTUROWNIA_ERROR',
    async ({ category, httpStatus }) => {
      const deal = bitrixDealForFull();
      setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));
      deps.fakturowniaService.createInvoice.mockRejectedValue(
        new FakturowniaApiError({
          category,
          message: 'Provider rejected invoice',
          httpStatus,
        }),
      );

      const result = await useCase.execute(command());

      expect(result.status).toBe('FAKTUROWNIA_ERROR');
      expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
      expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
        'process-uuid-1',
        expect.objectContaining({
          status: 'FAKTUROWNIA_ERROR',
          last_error_message: 'Provider rejected invoice',
        }),
      );
      expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'FAKTUROWNIA_ERROR' }),
      );
    },
  );

  it.each([
    { category: 'TIMEOUT' as const },
    { category: 'UNKNOWN' as const },
  ])(
    'maps Fakturownia $category error to UNKNOWN_AFTER_TIMEOUT',
    async ({ category }) => {
      const deal = bitrixDealForFull();
      setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));
      deps.fakturowniaService.createInvoice.mockRejectedValue(
        new FakturowniaApiError({
          category,
          message: 'Provider response uncertain',
        }),
      );

      const result = await useCase.execute(command());

      expect(result.status).toBe('UNKNOWN_AFTER_TIMEOUT');
      expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
      expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
        'process-uuid-1',
        expect.objectContaining({ status: 'UNKNOWN_AFTER_TIMEOUT' }),
      );
      expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'UNKNOWN_AFTER_TIMEOUT' }),
      );
    },
  );

  it('does not create InvoiceRecord when order ensure fails', async () => {
    const deal = bitrixDealForAdvance();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));
    deps.fakturowniaOrderEnsureService.ensureForDeal.mockRejectedValue(
      new FakturowniaApiError({
        category: 'CLIENT',
        message: 'Provider rejected order',
        httpStatus: 422,
      }),
    );

    const result = await useCase.execute(command());

    expect(result.status).toBe('FAKTUROWNIA_ERROR');
    expect(deps.fakturowniaService.createInvoice).not.toHaveBeenCalled();
    expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
  });

  it.each([
    { category: 'CLIENT' as const, httpStatus: 422 },
    { category: 'SERVER' as const, httpStatus: 503 },
  ])(
    'maps order ensure $category error to FAKTUROWNIA_ERROR',
    async ({ category, httpStatus }) => {
      const deal = bitrixDealForAdvance();
      setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));
      deps.fakturowniaOrderEnsureService.ensureForDeal.mockRejectedValue(
        new FakturowniaApiError({
          category,
          message: 'Provider rejected order',
          httpStatus,
        }),
      );

      const result = await useCase.execute(command());

      expect(result.status).toBe('FAKTUROWNIA_ERROR');
      expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
      expect(deps.fakturowniaService.createInvoice).not.toHaveBeenCalled();
      expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
        'process-uuid-1',
        expect.objectContaining({
          status: 'FAKTUROWNIA_ERROR',
          last_error_message: 'Provider rejected order',
        }),
      );
      expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'FAKTUROWNIA_ERROR' }),
      );
    },
  );

  it.each([
    { category: 'TIMEOUT' as const },
    { category: 'UNKNOWN' as const },
  ])(
    'maps order ensure $category error to UNKNOWN_AFTER_TIMEOUT',
    async ({ category }) => {
      const deal = bitrixDealForAdvance();
      setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
      deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('ADVANCE'));
      deps.fakturowniaOrderEnsureService.ensureForDeal.mockRejectedValue(
        new FakturowniaApiError({
          category,
          message: 'Provider order response uncertain',
        }),
      );

      const result = await useCase.execute(command());

      expect(result.status).toBe('UNKNOWN_AFTER_TIMEOUT');
      expect(deps.invoiceRecordRepository.insert).not.toHaveBeenCalled();
      expect(deps.fakturowniaService.createInvoice).not.toHaveBeenCalled();
      expect(deps.invoiceProcessRepository.updateStatus).toHaveBeenCalledWith(
        'process-uuid-1',
        expect.objectContaining({ status: 'UNKNOWN_AFTER_TIMEOUT' }),
      );
      expect(deps.invoiceEventRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({ event_type: 'UNKNOWN_AFTER_TIMEOUT' }),
      );
    },
  );

  it('does not perform Bitrix sync after successful invoice creation', async () => {
    const deal = bitrixDealForFull();
    setupBitrixMocks(deps, deal, bitrixCompanyValidFixture());
    deps.invoiceIdempotencyService.claim.mockResolvedValue(processRow('FULL'));

    await useCase.execute(command());

    expect(deps.bitrix24DealService.getDealById).toHaveBeenCalledTimes(1);
    expect(deps.bitrix24CompanyService.getCompanyById).toHaveBeenCalledWith('7', {
      addressSource: 'CRM_ADDRESS_LIST',
    });
    expect(deps.bitrix24ProductRowService.listByDealId).toHaveBeenCalledTimes(1);
  });
});
