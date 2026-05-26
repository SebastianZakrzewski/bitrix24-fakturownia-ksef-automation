import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { assertLiveTriggerSmokeReport } from '../report/assert-live-trigger-smoke-report';
import { buildLiveTestReportMarkdown } from '../report/report-writer';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
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
    expect(result.execution.requestSent).toBe(false);
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
    expect(result.execution.workflowExecuted).toBe(true);
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

  it('builds NOT_READY report with manualVerificationRequired without leaking secret', async () => {
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
    expect(report.manualVerificationRequired).toBe(true);
    expect(report.backendTriggerExecution.resultStatus).toBe(
      'BACKEND_TRIGGER_EXECUTION_BLOCKED',
    );

    process.env.LIVE_TEST_BACKEND_AUTH_SECRET = 'dummy-local-secret';
    const markdown = buildLiveTestReportMarkdown(report);
    expect(markdown).not.toContain('dummy-local-secret');
    delete process.env.LIVE_TEST_BACKEND_AUTH_SECRET;
  });
});
