import { readFileSync } from 'fs';
import { join } from 'path';
import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertDryRunReport } from '../report/assert-dry-run-report';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import {
  BackendDryRunAdapterError,
  simulateBackendDryRunWorkflow,
} from './backend-dry-run.adapter';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
};

const FORBIDDEN_ADAPTER_IMPORT_PATTERNS = [
  /modules\/invoices\/use-cases/i,
  /\/repositories\//i,
  /\bfrom\s+['"][^'"]*\/src\//,
  /\bfrom\s+['"]pg['"]/,
  /supabase/i,
  /prisma/i,
];

function extractImportLines(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^\s*import\s+/.test(line) || /require\(/.test(line));
}

describe('simulateBackendDryRunWorkflow', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['FULL', fullInvoiceDryRunContext, fullInvoiceScenario],
    ['ADVANCE', advanceInvoiceDryRunContext, advanceInvoiceScenario],
    ['FINAL', finalInvoiceDryRunContext, finalInvoiceScenario],
  ] as const)(
    '%s fixture produces typed backend dry-run result',
    async (_label, fixture, scenario) => {
      const adapterResult = simulateBackendDryRunWorkflow(fixture);
      const scenarioResult = await scenario.run();

      expect(global.fetch).not.toHaveBeenCalled();
      expect(adapterResult.scenarioType).toBe(fixture.scenarioType);
      expect(adapterResult.expectedInvoiceType).toBe(fixture.scenarioType);
      expect(adapterResult.backendMode).toBe('DRY_RUN');
      expect(adapterResult.resultStatus).toBe('BACKEND_DRY_RUN_SIMULATED');
      expect(adapterResult.backendWorkflowExecuted).toBe(false);
      expect(adapterResult.backendEndpointCalled).toBe(false);
      expect(adapterResult.useCaseExecuted).toBe(false);
      expect(adapterResult.invoiceProcessCreated).toBe(false);
      expect(adapterResult.invoiceRecordCreated).toBe(false);
      expect(adapterResult.dbWriteExecuted).toBe(false);
      expect(adapterResult.validationSimulated).toBe(true);
      expect(adapterResult.mappedFromFixture).toBe(true);
      expect(scenarioResult.backendDryRun).toEqual(adapterResult);
    },
  );

  it('ADVANCE adapter requires advanceAmountPln', () => {
    const invalid = { ...advanceInvoiceDryRunContext };
    delete (invalid as { advanceAmountPln?: string }).advanceAmountPln;

    expect(() => simulateBackendDryRunWorkflow(invalid)).toThrow(
      BackendDryRunAdapterError,
    );
  });

  it('FINAL adapter requires previousAdvanceInvoiceId', () => {
    const invalid = {
      ...finalInvoiceDryRunContext,
      previousAdvanceInvoiceId: '',
    };

    expect(() => simulateBackendDryRunWorkflow(invalid)).toThrow(
      BackendDryRunAdapterError,
    );
  });

  it('reports include backend dry-run section and pass strict assertions', async () => {
    const scenario = fullInvoiceScenario;
    const scenarioResult = await scenario.run();
    const report = buildLiveTestReport({
      scenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: true,
    });

    expect(report.backendDryRun.resultStatus).toBe('BACKEND_DRY_RUN_SIMULATED');
    expect(() => assertDryRunReport(report, 'full')).not.toThrow();
  });

  it('adapter source does not import backend use cases, repositories, or DB clients', () => {
    const adapterSource = readFileSync(
      join(__dirname, 'backend-dry-run.adapter.ts'),
      'utf8',
    );
    const typesSource = readFileSync(
      join(__dirname, 'backend-dry-run.types.ts'),
      'utf8',
    );

    for (const line of [
      ...extractImportLines(adapterSource),
      ...extractImportLines(typesSource),
    ]) {
      for (const pattern of FORBIDDEN_ADAPTER_IMPORT_PATTERNS) {
        expect(line).not.toMatch(pattern);
      }
      expect(line).not.toMatch(/\bCreateInvoiceFromBitrixDealUseCase\b/);
    }

    expect(adapterSource).not.toMatch(/\.\.\/\.\.\/src\//);
    expect(adapterSource).not.toMatch(/\bfetch\s*\(/);
  });
});
