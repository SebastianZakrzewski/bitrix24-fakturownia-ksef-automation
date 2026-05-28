import { fullInvoiceDryRunContext } from '../../fixtures/full-invoice.context';
import { advanceInvoiceDryRunContext } from '../../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../../fixtures/final-invoice.context';
import { parseBitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import type { BitrixTestSetupClient } from '../../bitrix-e2e-setup/bitrix-test-setup-client.types';
import {
  assertMatrixRunnerPassCaseCounts,
  listMatrixRunnerPassCases,
} from './list-matrix-runner-pass-cases';
import {
  buildMatrixBitrixDealPayload,
  resolveMatrixLiveDealTitle,
} from './build-matrix-bitrix-deal-payload';
import { evaluateMatrixLiveE2eGate } from './evaluate-matrix-live-e2e-gate';
import {
  evaluateMatrixBackendTriggerGate,
  isMatrixBackendTriggerEnabled,
} from './evaluate-matrix-backend-trigger-gate';
import { buildMatrixBitrixTriggerPayload } from './build-matrix-bitrix-trigger-payload';
import { buildMatrixFinalAdvanceSeedContext } from './build-matrix-final-advance-seed-context';
import { runMatrixLiveE2eCase } from './run-matrix-live-e2e-case';
import { runInvoiceMatrixLiveE2e } from './run-invoice-matrix-live-e2e';
import { INVOICE_RUNNER_MATRIX_CASES } from '../invoice-runner-matrix.cases';
import { EVAPREMIUM_BITRIX_FIELD_MAPPING as M } from '../../bitrix-e2e-setup/evapremium-bitrix-field-mapping';

const READY_RAW: Record<string, string> = {
  LIVE_TEST_MODE: 'true',
  LIVE_TEST_CONFIRM: 'true',
  ENABLE_EXTERNAL_SIDE_EFFECTS: 'true',
  ALLOW_TEST_DEAL_CREATION: 'true',
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: 'false',
  ALLOW_DELETE_OR_CANCEL: 'false',
  LIVE_TEST_ALLOW_MATRIX_LIVE_E2E: 'true',
  LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION: 'true',
  LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: 'true',
  LIVE_TEST_ALLOW_BITRIX_COMPANY_ADDRESS_ENSURE: 'true',
  LIVE_TEST_BITRIX_PAID_STAGE_ID: 'PREPARATION',
  LIVE_TEST_BITRIX_INITIAL_STAGE_ID: 'UC_NEW',
  BITRIX24_WEBHOOK_URL: 'https://example.bitrix24.pl/rest/1/dummy-token/',
  LIVE_TEST_BITRIX_EXISTING_COMPANY_ID: '9001',
};

function createMockBitrixClient(): jest.Mocked<BitrixTestSetupClient> {
  return {
    useExistingTestCompany: jest.fn().mockResolvedValue({ companyId: '9001' }),
    ensureExistingTestCompanyAddress: jest
      .fn()
      .mockResolvedValue({
        companyId: '9001',
        addressAlreadyPresent: true,
        addressAdded: false,
      }),
    ensureExistingTestCompanyRequisite: jest
      .fn()
      .mockResolvedValue({
        companyId: '9001',
        requisiteId: '3158',
        nipAlreadyValid: true,
        nipUpdated: false,
      }),
    createTestCompany: jest.fn(),
    createTestDeal: jest.fn().mockResolvedValue({ dealId: '8001' }),
    updateTestDeal: jest.fn().mockResolvedValue(undefined),
    setDealStage: jest.fn().mockResolvedValue(undefined),
  };
}

describe('matrix live E2E definition', () => {
  it('selects 45 runner-pass cases (15 per invoice type)', () => {
    const cases = listMatrixRunnerPassCases();
    expect(() => assertMatrixRunnerPassCaseCounts(cases)).not.toThrow();
    expect(cases).toHaveLength(45);
  });

  it('excludes guard cases from live E2E selection', () => {
    const passIds = new Set(listMatrixRunnerPassCases().map((item) => item.id));
    const guardCases = INVOICE_RUNNER_MATRIX_CASES.filter(
      (item) => item.expected.result !== 'RUNNER_PASS',
    );

    for (const guardCase of guardCases) {
      expect(passIds.has(guardCase.id)).toBe(false);
    }
  });
});

describe('buildMatrixBitrixDealPayload', () => {
  it('maps FULL fixture to Pełna Płatność deal fields', () => {
    const payload = buildMatrixBitrixDealPayload(fullInvoiceDryRunContext, 'UC_NEW');

    expect(payload.scenarioType).toBe('FULL');
    expect(payload.deal.customFields[M.paymentFormField]).toBe(M.paymentFormFullValueId);
    expect(payload.deal.productRows.length).toBeGreaterThan(0);
  });

  it('maps ADVANCE fixture with advance amount field', () => {
    const payload = buildMatrixBitrixDealPayload(advanceInvoiceDryRunContext, 'UC_NEW');

    expect(payload.scenarioType).toBe('ADVANCE');
    expect(payload.deal.customFields[M.paymentFormField]).toBe(M.paymentFormAdvanceValueId);
    expect(payload.deal.customFields[M.advanceAmountField]).toBe(500);
  });

  it('maps FINAL fixture with Dopełniająca field', () => {
    const payload = buildMatrixBitrixDealPayload(finalInvoiceDryRunContext, 'UC_NEW');

    expect(payload.scenarioType).toBe('FINAL');
    expect(payload.deal.customFields[M.invoiceDocumentTypeField]).toBe(
      M.invoiceDocumentTypeFinalValueId,
    );
  });

  it('suffixes deal title with matrix case id', () => {
    const title = resolveMatrixLiveDealTitle('full-005', fullInvoiceDryRunContext);
    expect(title).toContain('[TEST]');
    expect(title).toContain('full-005');
  });
});

describe('evaluateMatrixLiveE2eGate', () => {
  it('allows execution when documented matrix live flags are set', () => {
    const env = parseBitrixE2eSetupEnv({ ...READY_RAW });
    const gate = evaluateMatrixLiveE2eGate(
      env,
      'FULL',
      '[TEST] Matrix full-001',
      READY_RAW,
    );

    expect(gate.executionAllowed).toBe(true);
  });

  it('blocks when LIVE_TEST_ALLOW_MATRIX_LIVE_E2E is false', () => {
    const env = parseBitrixE2eSetupEnv({
      ...READY_RAW,
      LIVE_TEST_ALLOW_MATRIX_LIVE_E2E: 'false',
    });
    const gate = evaluateMatrixLiveE2eGate(
      env,
      'ADVANCE',
      '[TEST] Matrix advance-001',
      { ...READY_RAW, LIVE_TEST_ALLOW_MATRIX_LIVE_E2E: 'false' },
    );

    expect(gate.executionAllowed).toBe(false);
    expect(gate.blockers).toContain('LIVE_TEST_ALLOW_MATRIX_LIVE_E2E must be true');
  });
});

describe('runMatrixLiveE2eCase', () => {
  it('creates Bitrix deal and changes stage for FULL runner-pass case', async () => {
    const matrixCase = listMatrixRunnerPassCases().find((item) => item.id === 'full-001');
    expect(matrixCase).toBeDefined();

    const client = createMockBitrixClient();
    const env = parseBitrixE2eSetupEnv({ ...READY_RAW });
    const result = await runMatrixLiveE2eCase({
      matrixCase: matrixCase!,
      env,
      rawConfig: READY_RAW,
      client,
    });

    expect(result.status).toBe('MATRIX_LIVE_E2E_COMPLETED');
    expect(result.bitrixDealId).toBe('8001');
    expect(result.bitrixStageChanged).toBe(true);
    expect(result.runnerDirectBackendTrigger).toBe(false);
    expect(result.backendTriggerRequestSent).toBe(false);
    expect(client.createTestDeal).toHaveBeenCalledTimes(1);
    expect(client.setDealStage).toHaveBeenCalledWith('8001', 'PREPARATION');
  });

  it('POSTs backend trigger for FULL when matrix backend flag is enabled', async () => {
    const matrixCase = listMatrixRunnerPassCases().find((item) => item.id === 'full-001');
    expect(matrixCase).toBeDefined();

    const client = createMockBitrixClient();
    const env = parseBitrixE2eSetupEnv({ ...READY_RAW });
    const fetchMock = jest.fn().mockResolvedValue({
      status: 202,
      ok: true,
      text: async () =>
        JSON.stringify({
          status: 'INVOICE_CREATED',
          bitrix_deal_id: '8001',
          message: 'Invoice created',
        }),
    });

    const rawConfig = {
      ...READY_RAW,
      LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER: 'true',
      LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
      LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
      LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
      LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-secret',
    };

    const result = await runMatrixLiveE2eCase({
      matrixCase: matrixCase!,
      env,
      rawConfig,
      client,
      fetchImpl: fetchMock,
    });

    expect(result.status).toBe('MATRIX_LIVE_E2E_COMPLETED');
    expect(result.runnerDirectBackendTrigger).toBe(true);
    expect(result.backendTriggerRequestSent).toBe(true);
    expect(result.backendTrigger?.triggerStatus).toBe('INVOICE_CREATED');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('runs ADVANCE seed then FINAL trigger for FINAL runner-pass case', async () => {
    const matrixCase = listMatrixRunnerPassCases().find((item) => item.id === 'final-001');
    expect(matrixCase).toBeDefined();

    const client = createMockBitrixClient();
    const env = parseBitrixE2eSetupEnv({ ...READY_RAW });
    let callCount = 0;
    const fetchMock = jest.fn().mockImplementation(async () => {
      callCount += 1;
      return {
        status: 202,
        ok: true,
        text: async () =>
          JSON.stringify({
            status: callCount === 1 ? 'INVOICE_CREATED' : 'INVOICE_CREATED',
            bitrix_deal_id: '8001',
            message: 'Invoice created',
          }),
      };
    });

    const rawConfig = {
      ...READY_RAW,
      LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER: 'true',
      LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
      LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
      LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
      LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-secret',
    };

    const result = await runMatrixLiveE2eCase({
      matrixCase: matrixCase!,
      env,
      rawConfig,
      client,
      fetchImpl: fetchMock,
    });

    expect(result.status).toBe('MATRIX_LIVE_E2E_COMPLETED');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.advanceSeedBackendTrigger?.triggerStatus).toBe('INVOICE_CREATED');
    expect(result.backendTrigger?.triggerStatus).toBe('INVOICE_CREATED');
    expect(client.setDealStage).toHaveBeenCalledWith('8001', 'UC_NEW');
    expect(client.updateTestDeal).toHaveBeenCalledTimes(2);
  });
});

describe('matrix backend trigger helpers', () => {
  it('builds documented trigger payload from deal id', () => {
    const payload = buildMatrixBitrixTriggerPayload({
      bitrixDealId: '12345',
      paidStageId: 'PREPARATION',
      triggeredAt: '2026-05-27T00:00:00.000Z',
    });

    expect(payload).toEqual({
      bitrix_deal_id: '12345',
      trigger_source: 'BITRIX24_STAGE_CHANGE',
      trigger_stage_id: 'PREPARATION',
      triggered_at: '2026-05-27T00:00:00.000Z',
    });
  });

  it('allows matrix backend trigger gate when documented flags are set', () => {
    const env = parseBitrixE2eSetupEnv({ ...READY_RAW });
    const rawConfig = {
      ...READY_RAW,
      LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER: 'true',
      LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
      LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
      LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-secret',
    };

    const gate = evaluateMatrixBackendTriggerGate(
      env,
      '[TEST] Matrix full-001',
      '8001',
      rawConfig,
    );

    expect(gate.executionAllowed).toBe(true);
    expect(isMatrixBackendTriggerEnabled(rawConfig)).toBe(true);
  });

  it('builds ADVANCE seed context from FINAL fixture', () => {
    const seed = buildMatrixFinalAdvanceSeedContext(
      finalInvoiceDryRunContext,
      '[TEST] Matrix final-001',
    );

    expect(seed.scenarioType).toBe('ADVANCE');
    expect(seed.advanceAmountPln).toBe('500.00');
    expect(seed.products).toEqual(finalInvoiceDryRunContext.products);
  });
});

describe('runInvoiceMatrixLiveE2e', () => {
  it('runs selected matrix cases sequentially with one Bitrix client', async () => {
    const client = createMockBitrixClient();
    const { summary } = await runInvoiceMatrixLiveE2e({
      rawConfig: { ...READY_RAW, LIVE_TEST_MATRIX_LIVE_E2E_DELAY_MS: '0' },
      client,
      caseIds: ['full-001', 'advance-001', 'final-001'],
    });

    expect(summary.totalCases).toBe(3);
    expect(summary.completed).toBe(3);
    expect(client.createTestDeal).toHaveBeenCalledTimes(3);
  });
});
