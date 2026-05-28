import { BitrixInvoiceMapper } from '../../../src/modules/invoices/mappers/bitrix-invoice.mapper';
import { InvoiceValidationService } from '../../../src/modules/invoices/services/invoice-validation.service';
import {
  bitrixCompanyNoNip,
  bitrixCompanyValidFixture,
  bitrixDealAdvanceNoAmount,
  bitrixDealAdvanceWithAmount,
  bitrixDealEmptyProducts,
  bitrixDealForAdvance,
  bitrixDealForFinal,
  bitrixDealForFull,
  bitrixDealMissingInvoiceType,
  bitrixDealNoCompany,
  bitrixProductRowInvalidFixture,
  evapremiumClientConfigFixture,
} from '../../../src/modules/invoices/testing/invoice-mapping.fixtures';
import {
  restoreLiveTestEnvKeys,
  saveAndClearLiveTestEnvKeys,
} from '../isolate-live-test-env';
import { executeInvoiceRunnerMatrixCase } from './execute-invoice-runner-matrix-case';
import {
  ADVANCE_INVOICE_RUNNER_MATRIX_CASES,
  FINAL_INVOICE_RUNNER_MATRIX_CASES,
  FULL_INVOICE_RUNNER_MATRIX_CASES,
  INVOICE_RUNNER_MATRIX_CASES,
  assertInvoiceRunnerMatrixCounts,
  summarizeInvoiceRunnerMatrixCases,
} from './invoice-runner-matrix.cases';
import type { InvoiceRunnerMatrixCase } from './invoice-runner-matrix.types';

const mapper = new BitrixInvoiceMapper();
const validation = new InvoiceValidationService();
const config = evapremiumClientConfigFixture();

const BACKEND_VALIDATION_FIXTURES: Record<
  string,
  () => {
    deal: ReturnType<typeof bitrixDealForFull>;
    company?: ReturnType<typeof bitrixCompanyValidFixture>;
    context?: { previousAdvanceInvoiceId?: string };
  }
> = {
  'full-036': () => ({ deal: bitrixDealMissingInvoiceType(), company: bitrixCompanyValidFixture() }),
  'full-037': () => ({ deal: bitrixDealNoCompany(), company: undefined }),
  'full-038': () => ({ deal: bitrixDealForFull(), company: bitrixCompanyNoNip() }),
  'full-039': () => ({ deal: bitrixDealEmptyProducts(), company: bitrixCompanyValidFixture() }),
  'full-040': () => {
    const deal = bitrixDealForFull();
    deal.productRows = bitrixProductRowInvalidFixture();
    return { deal, company: bitrixCompanyValidFixture() };
  },
  'advance-036': () => ({
    deal: bitrixDealAdvanceNoAmount(),
    company: bitrixCompanyValidFixture(),
  }),
  'advance-037': () => ({
    deal: bitrixDealAdvanceWithAmount('0'),
    company: bitrixCompanyValidFixture(),
  }),
  'advance-038': () => ({
    deal: bitrixDealAdvanceWithAmount('-100'),
    company: bitrixCompanyValidFixture(),
  }),
  'advance-039': () => ({ deal: bitrixDealForAdvance(), company: bitrixCompanyNoNip() }),
  'advance-040': () => {
    const deal = bitrixDealForAdvance();
    deal.productRows = bitrixProductRowInvalidFixture();
    return { deal, company: bitrixCompanyValidFixture() };
  },
  'final-036': () => ({ deal: bitrixDealForFinal(), company: bitrixCompanyValidFixture() }),
  'final-037': () => ({ deal: bitrixDealMissingInvoiceType(), company: bitrixCompanyValidFixture() }),
  'final-038': () => ({ deal: bitrixDealForFinal(), company: bitrixCompanyNoNip() }),
  'final-039': () => {
    const deal = bitrixDealForFinal();
    deal.productRows = [];
    deal.customFields = {
      ...deal.customFields,
      OPPORTUNITY: '0',
    };
    return { deal, company: bitrixCompanyValidFixture() };
  },
  'final-040': () => {
    const deal = bitrixDealForFinal();
    deal.productRows = bitrixProductRowInvalidFixture();
    return { deal, company: bitrixCompanyValidFixture() };
  },
};

function executeBackendValidationMatrixCase(matrixCase: InvoiceRunnerMatrixCase): void {
  const fixtureFactory = BACKEND_VALIDATION_FIXTURES[matrixCase.id];

  if (!fixtureFactory) {
    throw new Error(`Missing backend validation fixture mapping for ${matrixCase.id}`);
  }

  const { deal, company, context = {} } = fixtureFactory();
  const mapping = mapper.map(deal, company, config);
  const result = validation.validate(mapping, config, context);

  expect(result.ok).toBe(false);

  if (result.ok) {
    return;
  }

  for (const code of matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT'
    ? matrixCase.expected.codes
    : []) {
    expect(result.errors.some((error: { code: string }) => error.code === code)).toBe(
      true,
    );
  }
}

describe('invoice runner matrix definition', () => {
  it('defines exactly 120 cases with 40 per invoice type', () => {
    expect(() => assertInvoiceRunnerMatrixCounts(INVOICE_RUNNER_MATRIX_CASES)).not.toThrow();
    expect(INVOICE_RUNNER_MATRIX_CASES).toHaveLength(120);
    expect(FULL_INVOICE_RUNNER_MATRIX_CASES).toHaveLength(40);
    expect(ADVANCE_INVOICE_RUNNER_MATRIX_CASES).toHaveLength(40);
    expect(FINAL_INVOICE_RUNNER_MATRIX_CASES).toHaveLength(40);
  });

  it('covers happy path, variants, contract, adapter and backend validation guards', () => {
    const summary = summarizeInvoiceRunnerMatrixCases();

    for (const invoiceType of ['FULL', 'ADVANCE', 'FINAL'] as const) {
      expect(summary[invoiceType].happy_path).toBe(1);
      expect(summary[invoiceType].valid_variant).toBe(14);
      expect(summary[invoiceType].contract_guard).toBe(13);
      expect(summary[invoiceType].adapter_guard).toBe(7);
      expect(summary[invoiceType].backend_validation_guard).toBe(5);
    }
  });
});

describe('invoice runner matrix — runner layer', () => {
  const originalFetch = global.fetch;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    Object.assign(savedEnv, saveAndClearLiveTestEnvKeys());
    global.fetch = jest.fn();
  });

  afterEach(() => {
    restoreLiveTestEnvKeys(savedEnv);
    Object.keys(savedEnv).forEach((key) => delete savedEnv[key]);
    global.fetch = originalFetch;
  });

  it.each(
    INVOICE_RUNNER_MATRIX_CASES.filter(
      (matrixCase) => matrixCase.expected.result !== 'BACKEND_VALIDATION_REJECT',
    ).map((matrixCase) => [matrixCase.id, matrixCase] as const),
  )('%s passes runner-layer matrix execution', async (_id, matrixCase) => {
    const result = await executeInvoiceRunnerMatrixCase(matrixCase);

    expect(result.passed).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('invoice runner matrix — backend validation guards', () => {
  it.each(
    INVOICE_RUNNER_MATRIX_CASES.filter(
      (matrixCase) => matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT',
    ).map((matrixCase) => [matrixCase.id, matrixCase] as const),
  )('%s blocks incorrect invoice creation in backend validation', (_id, matrixCase) => {
    executeBackendValidationMatrixCase(matrixCase);
  });
});

describe('invoice runner matrix — aggregate result', () => {
  const originalFetch = global.fetch;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    Object.assign(savedEnv, saveAndClearLiveTestEnvKeys());
    global.fetch = jest.fn();
  });

  afterEach(() => {
    restoreLiveTestEnvKeys(savedEnv);
    Object.keys(savedEnv).forEach((key) => delete savedEnv[key]);
    global.fetch = originalFetch;
  });

  it('executes all 120 matrix cases successfully', async () => {
    const runnerLayerFailures: string[] = [];

    for (const matrixCase of INVOICE_RUNNER_MATRIX_CASES) {
      if (matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT') {
        expect(() => executeBackendValidationMatrixCase(matrixCase)).not.toThrow();
        continue;
      }

      const result = await executeInvoiceRunnerMatrixCase(matrixCase);
      if (!result.passed) {
        runnerLayerFailures.push(`${matrixCase.id}: ${result.message}`);
      }
    }

    expect(runnerLayerFailures).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
