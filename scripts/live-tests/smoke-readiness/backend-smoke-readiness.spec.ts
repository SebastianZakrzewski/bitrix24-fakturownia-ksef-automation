import { readFileSync } from 'fs';
import { join } from 'path';
import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertDryRunReport } from '../report/assert-dry-run-report';
import { buildLiveTestReportMarkdown } from '../report/report-writer';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import {
  BACKEND_SMOKE_TRIGGER_METHOD,
  BACKEND_SMOKE_TRIGGER_PATH,
} from './backend-smoke-readiness.types';
import { parseBackendSmokeReadinessConfig } from './backend-smoke-readiness-config';
import { checkBackendSmokeReadiness } from './check-backend-smoke-readiness';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: false,
};

const readyConfig = {
  LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
  LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
  LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
  LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-local-secret',
};

const FORBIDDEN_SMOKE_IMPORT_PATTERNS = [
  /modules\/invoices\/use-cases/i,
  /\/repositories\//i,
  /\bfrom\s+['"][^'"]*\/src\//,
  /\bCreateInvoiceFromBitrixDealUseCase\b/,
];

function extractImportLines(content: string): string[] {
  return content
    .split('\n')
    .filter((line) => /^\s*import\s+/.test(line) || /require\(/.test(line));
}

describe('checkBackendSmokeReadiness', () => {
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
    '%s scenario produces backend smoke-readiness result',
    async (_label, fixture, scenario) => {
      const contract = mapBackendDryRunContract(fixture);
      const readiness = checkBackendSmokeReadiness({
        contract,
        config: parseBackendSmokeReadinessConfig(readyConfig),
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(readiness.scenarioType).toBe(fixture.scenarioType);
      expect(readiness.readinessKind).toBe('BACKEND_SMOKE_READINESS');
      expect(readiness.target.method).toBe(BACKEND_SMOKE_TRIGGER_METHOD);
      expect(readiness.target.path).toBe(BACKEND_SMOKE_TRIGGER_PATH);
      expect(readiness.target.endpointCallAllowed).toBe(false);
      expect(readiness.target.endpointCalled).toBe(false);
      expect(readiness.executionPolicy.backendEndpointAllowed).toBe(false);
      expect(readiness.executionPolicy.useCaseExecutionAllowed).toBe(false);
      expect(readiness.executionPolicy.dbWriteAllowed).toBe(false);
      expect(readiness.executionPolicy.externalSideEffectsAllowed).toBe(false);
      expect(readiness.auth.secretDisplayed).toBe(false);
      expect(readiness.readinessStatus).toBe('READY_FOR_CONTROLLED_BACKEND_SMOKE');

      const scenarioResult = await scenario.run();
      const report = buildLiveTestReport({
        scenario,
        scenarioResult,
        safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
        startedAt: new Date(),
        finishedAt: new Date(),
        reportWritten: true,
        smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
      });

      expect(report.backendSmokeReadiness.readinessStatus).toBe(
        'READY_FOR_CONTROLLED_BACKEND_SMOKE',
      );
    },
  );

  it('missing backend base URL results in NOT_READY with blocker', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const readiness = checkBackendSmokeReadiness({
      contract,
      config: parseBackendSmokeReadinessConfig({
        LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
        LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-local-secret',
      }),
    });

    expect(readiness.readinessStatus).toBe('NOT_READY_FOR_BACKEND_SMOKE');
    expect(readiness.blockers).toContain('LIVE_TEST_BACKEND_BASE_URL is not configured');
  });

  it('missing auth header name results in NOT_READY with blocker', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const readiness = checkBackendSmokeReadiness({
      contract,
      config: parseBackendSmokeReadinessConfig({
        LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
        LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-local-secret',
      }),
    });

    expect(readiness.readinessStatus).toBe('NOT_READY_FOR_BACKEND_SMOKE');
    expect(readiness.auth.headerNameConfigured).toBe(false);
    expect(readiness.blockers).toContain(
      'LIVE_TEST_BACKEND_AUTH_HEADER_NAME is not configured',
    );
  });

  it('missing auth secret results in NOT_READY with blocker', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const readiness = checkBackendSmokeReadiness({
      contract,
      config: parseBackendSmokeReadinessConfig({
        LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
        LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
      }),
    });

    expect(readiness.readinessStatus).toBe('NOT_READY_FOR_BACKEND_SMOKE');
    expect(readiness.blockers).toContain(
      'LIVE_TEST_BACKEND_AUTH_SECRET or N8N_API_KEY must be configured for backend trigger auth',
    );
  });

  it('configured auth secret is never included in report JSON or Markdown', async () => {
    const scenario = fullInvoiceScenario;
    const scenarioResult = await scenario.run();
    const report = buildLiveTestReport({
      scenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: true,
      smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
    });

    const json = JSON.stringify(report);
    const markdown = buildLiveTestReportMarkdown(report);

    expect(json).not.toContain('dummy-local-secret');
    expect(markdown).not.toContain('dummy-local-secret');
    expect(report.backendSmokeReadiness.auth.secretDisplayed).toBe(false);
    expect(() => assertDryRunReport(report, 'full')).not.toThrow();
  });

  it('contract compatibility is false when dry-run contract validation would fail', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    contract.trigger.trigger_source = 'INVALID' as 'BITRIX24_STAGE_CHANGE';

    const readiness = checkBackendSmokeReadiness({
      contract,
      config: parseBackendSmokeReadinessConfig(readyConfig),
    });

    expect(readiness.contract.compatibleWithBitrixTriggerRequestDto).toBe(false);
    expect(readiness.contract.contractValidationStatus).toBe('FAILED');
    expect(readiness.readinessStatus).toBe('NOT_READY_FOR_BACKEND_SMOKE');
  });

  it('smoke-readiness module does not import backend use cases, repositories, or DB clients', () => {
    const files = [
      'backend-smoke-readiness.types.ts',
      'backend-smoke-readiness-config.ts',
      'mask-backend-base-url.ts',
      'assess-bitrix-trigger-contract-compatibility.ts',
      'check-backend-smoke-readiness.ts',
    ];

    for (const file of files) {
      const source = readFileSync(join(__dirname, file), 'utf8');
      for (const line of extractImportLines(source)) {
        for (const pattern of FORBIDDEN_SMOKE_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }
      expect(source).not.toMatch(/\.\.\/\.\.\/src\//);
      expect(source).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
