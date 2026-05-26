import { parseBitrixE2eSetupEnv } from './bitrix-e2e-setup-env';
import { buildBlockedBitrixE2eSetup } from './build-blocked-bitrix-e2e-setup';
import { evaluateBitrixE2eSetupGate } from './evaluate-bitrix-e2e-setup-gate';
import { runBitrixE2eSetup } from './run-bitrix-e2e-setup';
import { buildBitrixE2eSetupReport } from '../report/build-bitrix-e2e-setup-report';
import { assertBitrixE2eSetupReport } from '../report/assert-bitrix-e2e-setup-report';
import { maskBitrixWebhookUrl } from './mask-bitrix-webhook-url';
import { resolveBitrixWebhookUrl } from './resolve-bitrix-webhook-url';
import type { BitrixTestSetupClient } from './bitrix-test-setup-client.types';
import * as triggerFetchModule from '../trigger-execution/fetch-backend-bitrix-trigger';
import { collectSafetyChecks } from '../safety-guards';
import { fullBitrixE2eSetupSafetyContext } from '../scenarios/full-bitrix-e2e-setup.scenario';

const READY_RAW: Record<string, string> = {
  LIVE_TEST_MODE: 'true',
  LIVE_TEST_CONFIRM: 'true',
  ENABLE_EXTERNAL_SIDE_EFFECTS: 'true',
  ALLOW_TEST_DEAL_CREATION: 'true',
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: 'false',
  ALLOW_DELETE_OR_CANCEL: 'false',
  LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION: 'true',
  LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: 'true',
  LIVE_TEST_BITRIX_INITIAL_STAGE_ID: 'UC_NEW',
  LIVE_TEST_BITRIX_PAID_STAGE_ID: 'PREPARATION',
  BITRIX24_WEBHOOK_URL: 'https://example.bitrix24.pl/rest/1/dummy-token/',
  LIVE_TEST_DEAL_LABEL: '[TEST] Mock FULL Bitrix E2E',
};

function createMockBitrixClient(): jest.Mocked<BitrixTestSetupClient> {
  return {
    createTestCompany: jest.fn().mockResolvedValue({ companyId: '9001' }),
    createTestDeal: jest.fn().mockResolvedValue({ dealId: '8001' }),
    updateTestDeal: jest.fn().mockResolvedValue(undefined),
    setDealStage: jest.fn().mockResolvedValue(undefined),
  };
}

function readyEnv() {
  return parseBitrixE2eSetupEnv({ ...READY_RAW });
}

describe('Bitrix E2E setup', () => {
  it('blocked setup report has realBitrixMutationExecuted=false', () => {
    const execution = buildBlockedBitrixE2eSetup(
      'FULL',
      '[TEST] blocked',
      'PREPARATION',
      ['LIVE_TEST_MODE must be true'],
    );
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    expect(report.realBitrixMutationExecuted).toBe(false);
    expect(report.bitrixDealCreated).toBe(false);
    expect(report.bitrixStageChanged).toBe(false);
    expect(report.backendWorkflowMayHaveExecuted).toBe(false);
    expect(report.backendSideEffectsMayHaveOccurred).toBe(false);
    expect(() => assertBitrixE2eSetupReport(report)).not.toThrow();
  });

  it('mocked FULL setup report has realBitrixMutationExecuted=true', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    expect(report.realBitrixMutationExecuted).toBe(true);
    expect(report.runnerDirectSideEffects.runnerDirectBitrixCall).toBe(true);
    expect(report.runnerDirectExternalSideEffectsExecuted).toBe(true);
    expect(() => assertBitrixE2eSetupReport(report)).not.toThrow();
  });

  it('when stageChanged=true report asserts backend may-execute flags and NOT_READY', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    expect(execution.bitrixStageChanged).toBe(true);
    expect(report.backendWorkflowMayHaveExecuted).toBe(true);
    expect(report.backendSideEffectsMayHaveOccurred).toBe(true);
    expect(report.manualVerificationRequired).toBe(true);
    expect(report.productionReadiness).toBe('NOT_READY');
    expect(report.runnerDirectBackendTrigger).toBe(false);
    expect(report.backendTriggerRequestSent).toBe(false);
  });

  it('blocks by default when Bitrix allow flags are false', () => {
    const env = parseBitrixE2eSetupEnv({
      LIVE_TEST_MODE: 'false',
      TEST_DEAL_PREFIX: '[TEST]',
    });
    const gate = evaluateBitrixE2eSetupGate(
      env,
      'FULL',
      '[TEST] blocked',
      {},
    );
    expect(gate.setupAllowed).toBe(false);
  });

  it('blocks when LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION is missing', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', '[TEST] deal', {
      ...READY_RAW,
      LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION: 'false',
    });
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION'))).toBe(
      true,
    );
  });

  it('blocks when LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE is missing', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', '[TEST] deal', {
      ...READY_RAW,
      LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: 'false',
    });
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE'))).toBe(true);
  });

  it('blocks when ALLOW_TEST_DEAL_CREATION is false', () => {
    const env = parseBitrixE2eSetupEnv({
      ...READY_RAW,
      ALLOW_TEST_DEAL_CREATION: 'false',
    });
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', '[TEST] deal', READY_RAW);
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('ALLOW_TEST_DEAL_CREATION'))).toBe(true);
  });

  it('blocks when deal title lacks [TEST] prefix', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', 'Production deal', READY_RAW);
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('[TEST]'))).toBe(true);
  });

  it('blocks ADVANCE setup', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'ADVANCE', '[TEST] advance', READY_RAW);
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('FULL'))).toBe(true);
  });

  it('blocks FINAL setup', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'FINAL', '[TEST] final', READY_RAW);
    expect(gate.setupAllowed).toBe(false);
  });

  it('blocks when ALLOW_BULK_LIVE_TESTS is true', () => {
    const env = parseBitrixE2eSetupEnv({
      ...READY_RAW,
      ALLOW_BULK_LIVE_TESTS: 'true',
    });
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', '[TEST] deal', READY_RAW);
    expect(gate.setupAllowed).toBe(false);
  });

  it('keeps deleteOrCancelExecuted false on report', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: collectSafetyChecks(readyEnv(), fullBitrixE2eSetupSafetyContext),
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      finishedAt: new Date('2026-01-01T00:00:01.000Z'),
    });
    expect(report.deleteOrCancelExecuted).toBe(false);
  });

  it('blocks when Bitrix auth/webhook is not configured', () => {
    const env = readyEnv();
    const gate = evaluateBitrixE2eSetupGate(env, 'FULL', '[TEST] deal', {
      BITRIX24_WEBHOOK_URL: '',
      LIVE_TEST_BITRIX_WEBHOOK_URL: '',
      LIVE_TEST_BITRIX_BASE_URL: '',
      LIVE_TEST_BITRIX_AUTH_SECRET: '',
    });
    expect(gate.setupAllowed).toBe(false);
    expect(gate.blockers.some((b) => b.includes('webhook') || b.includes('BITRIX'))).toBe(true);
  });

  it('calls mocked Bitrix create paths exactly once on valid FULL setup', async () => {
    const client = createMockBitrixClient();
    await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    expect(client.createTestCompany).toHaveBeenCalledTimes(1);
    expect(client.createTestDeal).toHaveBeenCalledTimes(1);
  });

  it('calls mocked Bitrix stage update exactly once on valid FULL setup', async () => {
    const client = createMockBitrixClient();
    await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    expect(client.setDealStage).toHaveBeenCalledTimes(1);
    expect(client.setDealStage).toHaveBeenCalledWith('8001', 'PREPARATION');
  });

  it('does not call backend trigger endpoint from runner', async () => {
    const triggerSpy = jest.spyOn(
      triggerFetchModule,
      'fetchBackendBitrixTrigger',
    );
    const client = createMockBitrixClient();
    await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    expect(triggerSpy).not.toHaveBeenCalled();
    triggerSpy.mockRestore();
  });

  it('does not call Fakturownia from runner', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.runnerDirectSideEffects.runnerDirectFakturowniaCall).toBe(false);
  });

  it('does not write DB from runner', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.runnerDirectSideEffects.runnerDirectDbWrite).toBe(false);
  });

  it('includes Bitrix E2E setup section in report', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.bitrixE2eSetup.mode).toBe('CONTROLLED_BITRIX_E2E_SETUP');
    expect(report.bitrixE2eSetup.scenarioType).toBe('FULL');
  });

  it('does not expose Bitrix auth/webhook/token in report JSON', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('dummy-token');
    expect(report.bitrixE2eSetup.secretDisplayed).toBe(false);
    expect(maskBitrixWebhookUrl(READY_RAW.BITRIX24_WEBHOOK_URL!)).not.toContain('dummy-token');
  });

  it('sets backendWorkflowMayHaveExecuted true after stageChanged', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    expect(execution.bitrixStageChanged).toBe(true);
    expect(execution.backendWorkflowMayHaveExecuted).toBe(true);
  });

  it('sets backendSideEffectsMayHaveOccurred true after stageChanged', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    expect(execution.bitrixStageChanged).toBe(true);
    expect(execution.backendSideEffectsMayHaveOccurred).toBe(true);
  });

  it('keeps productionReadiness NOT_READY', async () => {
    const client = createMockBitrixClient();
    const execution = await runBitrixE2eSetup({
      env: readyEnv(),
      scenarioType: 'FULL',
      rawConfig: READY_RAW,
      client,
    });
    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks: [],
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    expect(report.productionReadiness).toBe('NOT_READY');
    expect(() => assertBitrixE2eSetupReport(report)).not.toThrow();
  });

  it('resolves webhook from LIVE_TEST_BITRIX_BASE_URL and auth secret without exposing secret', () => {
    const resolved = resolveBitrixWebhookUrl({
      LIVE_TEST_BITRIX_BASE_URL: 'https://portal.example.bitrix24.pl',
      LIVE_TEST_BITRIX_AUTH_SECRET: 'super-secret-token',
    });
    expect(resolved.configured).toBe(true);
    expect(resolved.webhookMasked).toBe(
      'https://portal.example.bitrix24.pl/[bitrix-webhook-configured]',
    );
    expect(resolved.webhookMasked).not.toContain('super-secret-token');
  });
});
