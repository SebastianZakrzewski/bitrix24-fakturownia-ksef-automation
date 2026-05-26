import { readFileSync } from 'fs';
import { join } from 'path';
import { advanceInvoiceDryRunContext } from '../fixtures/advance-invoice.context';
import { finalInvoiceDryRunContext } from '../fixtures/final-invoice.context';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertDryRunReport } from '../report/assert-dry-run-report';
import { buildLiveTestReportMarkdown } from '../report/report-writer';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { parseBackendSmokeReadinessConfig } from '../smoke-readiness/backend-smoke-readiness-config';
import { resolveLiveSmokeTarget } from '../live-smoke-target/resolve-live-smoke-target';
import { validateLiveSmokeTarget } from '../live-smoke-target/validate-live-smoke-target';
import { buildBitrixTriggerPreflightPayload } from './build-bitrix-trigger-preflight-payload';
import { runBackendTriggerPreflight } from './run-backend-trigger-preflight';
import { validateBackendTriggerPreflightPayload } from './validate-backend-trigger-preflight-payload';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { BACKEND_TRIGGER_PREFLIGHT_PATH } from './backend-trigger-preflight.types';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';

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

const FORBIDDEN_PREFLIGHT_IMPORT_PATTERNS = [
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

function contractFromContext(
  context: typeof fullInvoiceDryRunContext,
): BackendDryRunContract {
  return mapBackendDryRunContract(context);
}

function validatePreflightPayload(
  contract: BackendDryRunContract,
  context: LiveTestScenarioContext,
  payload: ReturnType<typeof buildBitrixTriggerPreflightPayload>,
) {
  const liveSmokeTarget = resolveLiveSmokeTarget(context, {});
  const liveSmokeTargetValidation = validateLiveSmokeTarget({
    target: liveSmokeTarget,
    scenarioType: contract.scenarioType,
  });

  return validateBackendTriggerPreflightPayload(
    contract,
    liveSmokeTarget,
    liveSmokeTargetValidation,
    payload,
  );
}

describe('runBackendTriggerPreflight', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([
    ['FULL', fullInvoiceDryRunContext],
    ['ADVANCE', advanceInvoiceDryRunContext],
    ['FINAL', finalInvoiceDryRunContext],
  ] as const)('%s creates valid backend trigger preflight with ready config', (_label, context) => {
    const contract = contractFromContext(context);
    const config = parseBackendSmokeReadinessConfig(readyConfig);
    const result = runBackendTriggerPreflight(contract, config, context, {});

    expect(result.preflightKind).toBe('BACKEND_TRIGGER_PREFLIGHT');
    expect(result.scenarioType).toBe(contract.scenarioType);
    expect(result.target.method).toBe('POST');
    expect(result.target.path).toBe(BACKEND_TRIGGER_PREFLIGHT_PATH);
    expect(result.request.payloadShapeValid).toBe(true);
    expect(result.preflightStatus).toBe('BACKEND_TRIGGER_PREFLIGHT_PASSED');
    expect(result.request.payload.bitrix_deal_id).toBe(context.bitrixDealId);
    expect(result.liveSmokeTarget.testDealLabelStartsWithTestPrefix).toBe(true);
    expect(result.request.payload.trigger_source).toBe('BITRIX24_STAGE_CHANGE');
  });

  it('preflight payload matches BitrixTriggerRequestDto shape', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);

    expect(payload).toEqual({
      bitrix_deal_id: liveSmokeTarget.actualBitrixDealId,
      trigger_source: 'BITRIX24_STAGE_CHANGE',
      trigger_stage_id: liveSmokeTarget.expectedTriggerStageId,
      triggered_at: contract.trigger.triggered_at,
    });
  });

  it('missing trigger_stage_id fails preflight validation', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      fullInvoiceDryRunContext,
      { ...payload, trigger_stage_id: '   ' },
    );

    expect(validation.valid).toBe(false);
  });

  it('invalid triggered_at fails preflight validation', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      fullInvoiceDryRunContext,
      { ...payload, triggered_at: 'not-a-timestamp' },
    );

    expect(validation.valid).toBe(false);
  });

  it('wrong trigger_source fails preflight validation', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      fullInvoiceDryRunContext,
      { ...payload, trigger_source: 'MANUAL' as typeof payload.trigger_source },
    );

    expect(validation.valid).toBe(false);
  });

  it('scenario mismatch fails preflight validation', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const mismatched: BackendDryRunContract = {
      ...contract,
      scenarioType: 'ADVANCE',
      expectedInvoiceType: 'FULL',
    };
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(mismatched, liveSmokeTarget);
    const validation = validatePreflightPayload(
      mismatched,
      fullInvoiceDryRunContext,
      payload,
    );

    expect(validation.valid).toBe(false);
  });

  it('payload bitrix_deal_id must match actualBitrixDealId', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const liveSmokeTarget = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      fullInvoiceDryRunContext,
      { ...payload, bitrix_deal_id: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID },
    );

    expect(validation.valid).toBe(false);
  });

  it('missing backend config returns NOT_READY without sending requests', () => {
    const contract = contractFromContext(fullInvoiceDryRunContext);
    const result = runBackendTriggerPreflight(
      contract,
      {},
      fullInvoiceDryRunContext,
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.preflightStatus).toBe('BACKEND_TRIGGER_PREFLIGHT_NOT_READY');
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it('execution flags remain false and secrets are never displayed', () => {
    const contract = contractFromContext(advanceInvoiceDryRunContext);
    const result = runBackendTriggerPreflight(
      contract,
      parseBackendSmokeReadinessConfig(readyConfig),
      advanceInvoiceDryRunContext,
    );

    expect(result.execution.requestSent).toBe(false);
    expect(result.execution.endpointCalled).toBe(false);
    expect(result.execution.workflowExecuted).toBe(false);
    expect(result.execution.dbWriteExecuted).toBe(false);
    expect(result.execution.bitrixCalled).toBe(false);
    expect(result.execution.fakturowniaCalled).toBe(false);
    expect(result.execution.ksefTested).toBe(false);
    expect(result.target.secretDisplayed).toBe(false);
    expect(result.executionPolicy.triggerExecutionAllowed).toBe(false);
    expect(JSON.stringify(result)).not.toContain(readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET);
  });

  it('ADVANCE requires advance amount in fixture context', () => {
    const contract: BackendDryRunContract = {
      ...contractFromContext(advanceInvoiceDryRunContext),
      fixtureContext: {
        fixtureId: 'test',
        bitrixDealId: '[TEST]-advance',
        hasSyntheticBuyer: true,
        hasProducts: true,
      },
    };
    const liveSmokeTarget = resolveLiveSmokeTarget(advanceInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      advanceInvoiceDryRunContext,
      payload,
    );

    expect(validation.valid).toBe(false);
  });

  it('FINAL requires prior advance reference in fixture context', () => {
    const contract: BackendDryRunContract = {
      ...contractFromContext(finalInvoiceDryRunContext),
      fixtureContext: {
        fixtureId: 'test',
        bitrixDealId: '[TEST]-final',
        hasSyntheticBuyer: true,
        hasProducts: true,
      },
    };
    const liveSmokeTarget = resolveLiveSmokeTarget(finalInvoiceDryRunContext, {});
    const payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validatePreflightPayload(
      contract,
      finalInvoiceDryRunContext,
      payload,
    );

    expect(validation.valid).toBe(false);
  });
});

describe('backend trigger preflight in live-test reports', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn(async () => new Response('ok', { status: 200 }));
    process.env.LIVE_TEST_BACKEND_BASE_URL = readyConfig.LIVE_TEST_BACKEND_BASE_URL;
    process.env.LIVE_TEST_BACKEND_TRIGGER_PATH = readyConfig.LIVE_TEST_BACKEND_TRIGGER_PATH;
    process.env.LIVE_TEST_BACKEND_AUTH_HEADER_NAME =
      readyConfig.LIVE_TEST_BACKEND_AUTH_HEADER_NAME;
    process.env.LIVE_TEST_BACKEND_AUTH_SECRET =
      readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET;
    process.env.LIVE_TEST_BACKEND_HEALTH_PATH = '/health';
    process.env.LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS = '5000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.LIVE_TEST_BACKEND_BASE_URL;
    delete process.env.LIVE_TEST_BACKEND_TRIGGER_PATH;
    delete process.env.LIVE_TEST_BACKEND_AUTH_HEADER_NAME;
    delete process.env.LIVE_TEST_BACKEND_AUTH_SECRET;
    delete process.env.LIVE_TEST_BACKEND_HEALTH_PATH;
    delete process.env.LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS;
  });

  it.each([
    ['full', fullInvoiceScenario],
    ['advance', advanceInvoiceScenario],
    ['final', finalInvoiceScenario],
  ] as const)(
    '%s report includes backendTriggerPreflight and strict assertions pass',
    async (scenarioId, scenario) => {
      const scenarioResult = await scenario.run();
      const report = buildLiveTestReport({
        scenario,
        scenarioResult,
        safetyChecks: collectSafetyChecks(validEnv, scenario.safetyContext),
        startedAt: new Date('2026-05-26T12:00:00.000Z'),
        finishedAt: new Date('2026-05-26T12:00:01.000Z'),
        reportWritten: true,
        smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
      });

      const markdown = buildLiveTestReportMarkdown(report);
      const json = JSON.stringify(report);

      expect(report.backendTriggerPreflight.preflightKind).toBe(
        'BACKEND_TRIGGER_PREFLIGHT',
      );
      expect(report.backendTriggerPreflight.execution.requestSent).toBe(false);
      expect(report.backendTriggerPreflight.liveSmokeTarget.testDealLabel).toContain(
        '[TEST]',
      );
      expect(
        report.backendTriggerPreflight.liveSmokeTarget.manualCrmPreparationConfirmed,
      ).toBe(false);
      expect(report.productionReadiness).toBe('NOT_READY');
      expect(report.externalSideEffectsExecuted).toBe(false);
      expect(json).not.toContain(readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET);
      expect(markdown).not.toContain(readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET);
      expect(markdown).toContain('## Backend trigger preflight');

      assertDryRunReport(report, scenarioId);
    },
  );

  it('dry-run executor does not POST to bitrix-trigger', async () => {
    const fetchMock = jest.fn(async () => new Response('ok', { status: 200 }));
    global.fetch = fetchMock;

    await executeDryRunScenario({
      context: fullInvoiceDryRunContext,
      availabilityConfig: {
        baseUrl: readyConfig.LIVE_TEST_BACKEND_BASE_URL,
        healthPath: '/health',
        timeoutMs: 5000,
      },
      triggerPreflightConfig: parseBackendSmokeReadinessConfig(readyConfig),
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalled();
    const calledUrls = fetchMock.mock.calls.map((call) =>
      String((call as unknown as [string])[0]),
    );
    expect(calledUrls.every((url) => url.includes('/health'))).toBe(true);
    expect(calledUrls.some((url) => url.includes('bitrix-trigger'))).toBe(false);
  });
});

describe('trigger-preflight import boundary', () => {
  const preflightRoot = join(__dirname);

  it('trigger-preflight sources do not import forbidden backend modules', () => {
    const files = [
      'backend-trigger-preflight.types.ts',
      'build-bitrix-trigger-preflight-payload.ts',
      'validate-backend-trigger-preflight-payload.ts',
      'run-backend-trigger-preflight.ts',
      'to-backend-trigger-preflight-report.ts',
    ];

    for (const file of files) {
      const content = readFileSync(join(preflightRoot, file), 'utf8');
      const importLines = extractImportLines(content);

      for (const line of importLines) {
        for (const pattern of FORBIDDEN_PREFLIGHT_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }

      expect(content).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
