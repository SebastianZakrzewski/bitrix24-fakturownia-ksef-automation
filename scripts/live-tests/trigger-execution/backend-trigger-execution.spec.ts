import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { LiveTriggerSmokeReportAssertionError } from '../report/assert-live-trigger-smoke-report';
import { assertLiveTriggerSmokeReport } from '../report/assert-live-trigger-smoke-report';
import { assertReportSideEffectSemantics } from '../side-effects/assert-backend-trigger-side-effect-semantics';
import { buildLiveTestReportMarkdown } from '../report/report-writer';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { executeLiveTriggerSmokeScenario } from '../execution/execute-live-trigger-smoke-scenario';
import { fullInvoiceTriggerSmokeScenario } from '../scenarios/full-invoice-trigger-smoke.scenario';
import {
  evaluateBackendTriggerExecutionGate,
} from './evaluate-backend-trigger-execution-gate';
import {
  resetBackendTriggerExecutionGuardForTests,
  runBackendTriggerExecutionSmoke,
} from './run-backend-trigger-execution-smoke';
import {
  restoreLiveTestEnvKeys,
  saveAndClearLiveTestEnvKeys,
} from '../isolate-live-test-env';
import { parseLiveTestEnv } from '../live-test-env';

const baseEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: true,
  ENABLE_EXTERNAL_SIDE_EFFECTS: true,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: false,
};

const readyRawConfig = {
  LIVE_TEST_MODE: 'true',
  LIVE_TEST_CONFIRM: 'true',
  ENABLE_EXTERNAL_SIDE_EFFECTS: 'true',
  ALLOW_TEST_DEAL_CREATION: 'false',
  ALLOW_BULK_LIVE_TESTS: 'false',
  ALLOW_DELETE_OR_CANCEL: 'false',
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: 'true',
  TEST_DEAL_PREFIX: '[TEST]',
  LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
  LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
  LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
  LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-local-secret',
  LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
  LIVE_TEST_DEAL_LABEL: '[TEST] Controlled trigger smoke',
  LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED: 'true',
  LIVE_TEST_EXPECTED_TRIGGER_STAGE_ID: 'PREPARATION',
};

describe('backend trigger execution gate', () => {
  it('blocks by default when LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION is false', () => {
    const gate = evaluateBackendTriggerExecutionGate(
      baseEnv,
      fullInvoiceDryRunContext,
      { ...readyRawConfig, LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: 'false' },
    );

    expect(gate.executionAllowed).toBe(false);
    expect(gate.blockers).toContain(
      'LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION must be true',
    );
  });

  it('allows when N8N_API_KEY is set but LIVE_TEST_BACKEND_AUTH_SECRET is unset', () => {
    const env = parseLiveTestEnv({
      ...readyRawConfig,
      LIVE_TEST_BACKEND_AUTH_SECRET: undefined,
      N8N_API_KEY: 'n8n-secret',
    });
    const gate = evaluateBackendTriggerExecutionGate(
      env,
      fullInvoiceDryRunContext,
      {
        ...readyRawConfig,
        LIVE_TEST_BACKEND_AUTH_SECRET: undefined,
        N8N_API_KEY: 'n8n-secret',
      },
    );

    expect(gate.executionAllowed).toBe(true);
  });

  it('allows only when all documented flags and live smoke target pass', () => {
    const env = parseLiveTestEnv(readyRawConfig);
    const gate = evaluateBackendTriggerExecutionGate(
      env,
      fullInvoiceDryRunContext,
      readyRawConfig,
    );

    expect(gate.executionAllowed).toBe(true);
    expect(gate.triggerExecutionAllowed).toBe(true);
  });
});

describe('runBackendTriggerExecutionSmoke', () => {
  beforeEach(() => {
    resetBackendTriggerExecutionGuardForTests();
  });

  it('does not send POST when gate is blocked', async () => {
    const fetchMock = jest.fn();
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const result = await runBackendTriggerExecutionSmoke({
      env: baseEnv,
      context: fullInvoiceDryRunContext,
      contract,
      rawConfig: { LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: 'false' },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.resultStatus).toBe('BACKEND_TRIGGER_EXECUTION_BLOCKED');
    expect(result.systemEffects.backendTriggerRequestSent).toBe(false);
    expect(result.systemEffects.backendWorkflowExecutionAttempted).toBe(false);
    expect(result.systemEffects.backendSideEffectsMayHaveOccurred).toBe(false);
    expect(result.runnerDirect.runnerDirectExternalSideEffectsExecuted).toBe(false);
  });

  it('sends exactly one POST with documented payload when gate allows', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ process_id: 'proc-1', status: 'ACCEPTED' }), {
        status: 202,
      }),
    );
    const env = parseLiveTestEnv(readyRawConfig);
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const result = await runBackendTriggerExecutionSmoke({
      env,
      context: fullInvoiceDryRunContext,
      contract,
      rawConfig: readyRawConfig,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'x-api-key': 'dummy-local-secret' });
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    expect(body.bitrix_deal_id).toBe(LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID);
    expect(body.trigger_source).toBe('BITRIX24_STAGE_CHANGE');
    expect(body.trigger_stage_id).toBe('PREPARATION');
    expect(body.triggered_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.resultStatus).toBe('BACKEND_TRIGGER_EXECUTION_SENT');
    expect(result.systemEffects.backendTriggerRequestSent).toBe(true);
    expect(result.systemEffects.backendEndpointCalled).toBe(true);
    expect(result.systemEffects.backendWorkflowExecutionAttempted).toBe(true);
    expect(result.systemEffects.backendWorkflowMayHaveExecuted).toBe(true);
    expect(result.systemEffects.backendSideEffectsMayHaveOccurred).toBe(true);
    expect(result.runnerDirect.runnerDirectBitrixCall).toBe(false);
    expect(result.runnerDirect.runnerDirectFakturowniaCall).toBe(false);
    expect(result.runnerDirect.runnerDirectDbWrite).toBe(false);
    expect(result.runnerDirect.runnerDirectKsefCall).toBe(false);
    expect(JSON.stringify(result)).not.toContain('dummy-local-secret');
  });

  it('blocks a second POST in the same process', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      new Response('{}', { status: 202 }),
    );
    const env = parseLiveTestEnv(readyRawConfig);
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);

    await runBackendTriggerExecutionSmoke({
      env,
      context: fullInvoiceDryRunContext,
      contract,
      rawConfig: readyRawConfig,
      fetchImpl: fetchMock,
    });
    const second = await runBackendTriggerExecutionSmoke({
      env,
      context: fullInvoiceDryRunContext,
      contract,
      rawConfig: readyRawConfig,
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.resultStatus).toBe('BACKEND_TRIGGER_EXECUTION_BLOCKED');
    expect(second.gate.blockers).toContain(
      'Only one backend trigger POST is allowed per runner process',
    );
  });
});

describe('controlled live trigger smoke report', () => {
  const saved = saveAndClearLiveTestEnvKeys();

  afterAll(() => {
    restoreLiveTestEnvKeys(saved);
  });

  it('builds blocked NOT_READY report without manual verification when POST not sent', async () => {
    process.env.LIVE_TEST_MODE = 'true';
    process.env.LIVE_TEST_CONFIRM = 'true';
    process.env.ENABLE_EXTERNAL_SIDE_EFFECTS = 'true';
    process.env.ALLOW_TEST_DEAL_CREATION = 'false';
    process.env.TEST_DEAL_PREFIX = '[TEST]';
    process.env.ALLOW_BULK_LIVE_TESTS = 'false';
    process.env.ALLOW_DELETE_OR_CANCEL = 'false';
    process.env.LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION = 'false';

    resetBackendTriggerExecutionGuardForTests();
    const scenarioResult = await fullInvoiceTriggerSmokeScenario.run();
    const env = parseLiveTestEnv(process.env);
    const report = buildLiveTestReport({
      scenario: fullInvoiceTriggerSmokeScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(
        env,
        fullInvoiceTriggerSmokeScenario.safetyContext,
      ),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    assertLiveTriggerSmokeReport(report);
    expect(report.productionReadiness).toBe('NOT_READY');
    expect(report.manualVerificationRequired).toBe(false);
    expect(report.backendTriggerExecution.resultStatus).toBe(
      'BACKEND_TRIGGER_EXECUTION_BLOCKED',
    );
    expect(
      report.backendTriggerExecution.systemEffects.backendSideEffectsMayHaveOccurred,
    ).toBe(false);

    const markdown = buildLiveTestReportMarkdown(report);
    expect(markdown).toContain('Backend trigger request sent: **false**');
    expect(markdown).toContain('Backend side effects may have occurred: **false**');
    expect(markdown).toContain('Manual verification required: **false**');
  });

  it('builds mocked-sent report with backend side effects may have occurred', async () => {
    resetBackendTriggerExecutionGuardForTests();
    const fetchMock = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ process_id: 'proc-1', status: 'ACCEPTED' }), {
        status: 202,
      }),
    );
    process.env.LIVE_TEST_MODE = 'true';
    process.env.LIVE_TEST_CONFIRM = 'true';
    process.env.ENABLE_EXTERNAL_SIDE_EFFECTS = 'true';
    process.env.ALLOW_TEST_DEAL_CREATION = 'false';
    process.env.TEST_DEAL_PREFIX = '[TEST]';
    process.env.ALLOW_BULK_LIVE_TESTS = 'false';
    process.env.ALLOW_DELETE_OR_CANCEL = 'false';
    process.env.LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION = 'true';
    process.env.LIVE_TEST_BACKEND_BASE_URL = 'http://localhost:3000';
    process.env.LIVE_TEST_BACKEND_TRIGGER_PATH = '/invoice-processes/bitrix-trigger';
    process.env.LIVE_TEST_BACKEND_AUTH_HEADER_NAME = 'x-api-key';
    process.env.LIVE_TEST_BACKEND_AUTH_SECRET = 'dummy-local-secret';
    process.env.LIVE_TEST_ACTUAL_BITRIX_DEAL_ID = LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID;
    process.env.LIVE_TEST_DEAL_LABEL = '[TEST] Controlled trigger smoke';
    process.env.LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED = 'true';
    process.env.LIVE_TEST_EXPECTED_TRIGGER_STAGE_ID = 'PREPARATION';

    const env = parseLiveTestEnv(process.env);
    const scenarioResult = await executeLiveTriggerSmokeScenario({
      env,
      context: fullInvoiceDryRunContext,
      rawConfig: process.env,
      triggerFetchImpl: fetchMock,
    });
    const report = buildLiveTestReport({
      scenario: fullInvoiceTriggerSmokeScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(
        env,
        fullInvoiceTriggerSmokeScenario.safetyContext,
      ),
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    assertLiveTriggerSmokeReport(report);
    expect(report.productionReadiness).toBe('NOT_READY');
    expect(report.manualVerificationRequired).toBe(true);
    expect(report.runnerDirectExternalSideEffectsExecuted).toBe(false);
    expect(report.backendTriggerExecution.systemEffects.backendTriggerRequestSent).toBe(
      true,
    );
    expect(
      report.backendTriggerExecution.systemEffects.backendSideEffectsMayHaveOccurred,
    ).toBe(true);

    const markdown = buildLiveTestReportMarkdown(report);
    expect(markdown).toContain('Backend trigger request sent: **true**');
    expect(markdown).toContain('Backend side effects may have occurred: **true**');
    expect(markdown).toContain('Manual verification required: **true**');
    expect(markdown).not.toContain('dummy-local-secret');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    delete process.env.LIVE_TEST_BACKEND_AUTH_SECRET;
  });

  it('fails semantics when requestSent semantics are inconsistent', () => {
    expect(() =>
      assertReportSideEffectSemantics({
        runnerDirect: {
          runnerDirectBitrixCall: false,
          runnerDirectFakturowniaCall: false,
          runnerDirectDbWrite: false,
          runnerDirectKsefCall: false,
          runnerDirectExternalSideEffectsExecuted: false,
        },
        runnerDirectExternalSideEffectsExecuted: false,
        manualVerificationRequired: false,
        systemEffects: {
          backendTriggerRequestSent: true,
          backendEndpointCalled: true,
          backendWorkflowExecutionAttempted: false,
          backendWorkflowMayHaveExecuted: true,
          backendSideEffectsMayHaveOccurred: false,
          dbWriteMayHaveOccurred: true,
          bitrixMayHaveBeenCalled: true,
          fakturowniaMayHaveBeenCalled: true,
          invoiceMayHaveBeenCreated: 'unknown',
          ksefMayHaveBeenHandledByFakturownia: 'unknown',
        },
      }),
    ).toThrow(/backendWorkflowExecutionAttempted/);
  });

  it('fails live trigger report assertion when POST sent but manual verification false', async () => {
    resetBackendTriggerExecutionGuardForTests();
    const report = buildLiveTestReport({
      scenario: fullInvoiceTriggerSmokeScenario,
      scenarioResult: {
        status: 'DRY_RUN_COMPLETED',
        executionMode: 'CONTROLLED_LIVE_TRIGGER_SMOKE',
        externalSideEffectsExecuted: false,
        context: fullInvoiceDryRunContext,
        backendTriggerExecution: await runBackendTriggerExecutionSmoke({
          env: parseLiveTestEnv(readyRawConfig),
          context: fullInvoiceDryRunContext,
          contract: mapBackendDryRunContract(fullInvoiceDryRunContext),
          rawConfig: readyRawConfig,
          fetchImpl: jest.fn().mockResolvedValue(new Response('{}', { status: 202 })),
        }),
        steps: [],
        message: 'test',
      },
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    const invalid = {
      ...report,
      manualVerificationRequired: false,
    };

    expect(() => assertLiveTriggerSmokeReport(invalid)).toThrow(
      LiveTriggerSmokeReportAssertionError,
    );
  });
});
