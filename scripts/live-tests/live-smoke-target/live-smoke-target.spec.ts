import { readFileSync } from 'fs';
import { join } from 'path';
import { BITRIX_PAID_STAGE_ID } from '../fixtures/fixture-common';
import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { buildBitrixTriggerPreflightPayload } from '../trigger-preflight/build-bitrix-trigger-preflight-payload';
import { runBackendTriggerPreflight } from '../trigger-preflight/run-backend-trigger-preflight';
import { parseLiveSmokeTargetConfig } from './parse-live-smoke-target-config';
import { resolveLiveSmokeTarget } from './resolve-live-smoke-target';
import { validateLiveSmokeTarget } from './validate-live-smoke-target';
import {
  LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
  type LiveSmokeTarget,
} from './live-smoke-target.types';

const FORBIDDEN_LIVE_SMOKE_IMPORT_PATTERNS = [
  /modules\/invoices\/use-cases/i,
  /\/repositories\//i,
  /\bfrom\s+['"][^'"]*\/src\//,
];

function baseTarget(overrides: Partial<LiveSmokeTarget> = {}): LiveSmokeTarget {
  return {
    actualBitrixDealId: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    testDealLabel: '[TEST] Runner FULL smoke test 001',
    expectedScenarioType: 'FULL',
    expectedTriggerStageId: BITRIX_PAID_STAGE_ID,
    manualCrmPreparationConfirmed: false,
    ...overrides,
  };
}

describe('validateLiveSmokeTarget', () => {
  it('accepts numeric actualBitrixDealId when testDealLabel starts with [TEST]', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget(),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(true);
    expect(result.testDealLabelStartsWithTestPrefix).toBe(true);
    expect(result.liveExecutionReady).toBe(false);
  });

  it('fails when testDealLabel is missing', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget({ testDealLabel: '   ' }),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('testDealLabel is required');
  });

  it('fails when testDealLabel does not start with [TEST]', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget({ testDealLabel: 'Production deal title' }),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(false);
    expect(result.testDealLabelStartsWithTestPrefix).toBe(false);
  });

  it('fails when actualBitrixDealId is missing', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget({ actualBitrixDealId: '' }),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('actualBitrixDealId is required');
  });

  it('fails on scenario mismatch', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget({ expectedScenarioType: 'ADVANCE' }),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('expectedScenarioType must match selected scenario');
  });

  it('fails when expectedTriggerStageId is missing', () => {
    const result = validateLiveSmokeTarget({
      target: baseTarget({ expectedTriggerStageId: '   ' }),
      scenarioType: 'FULL',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('expectedTriggerStageId is required');
  });

  it('marks live execution ready only when manual CRM preparation is confirmed', () => {
    const notReady = validateLiveSmokeTarget({
      target: baseTarget({ manualCrmPreparationConfirmed: false }),
      scenarioType: 'FULL',
    });
    const ready = validateLiveSmokeTarget({
      target: baseTarget({ manualCrmPreparationConfirmed: true }),
      scenarioType: 'FULL',
    });

    expect(notReady.liveExecutionReady).toBe(false);
    expect(ready.liveExecutionReady).toBe(true);
  });
});

describe('resolveLiveSmokeTarget', () => {
  it('uses fixture defaults in dry-run without env overrides', () => {
    const target = resolveLiveSmokeTarget(fullInvoiceDryRunContext, {});

    expect(target.actualBitrixDealId).toBe('[TEST]-FULL-001');
    expect(target.testDealLabel).toBe(fullInvoiceDryRunContext.testDealTitle);
    expect(target.manualCrmPreparationConfirmed).toBe(false);
  });

  it('uses configured numeric actualBitrixDealId from env', () => {
    const target = resolveLiveSmokeTarget(
      fullInvoiceDryRunContext,
      parseLiveSmokeTargetConfig({
        LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        LIVE_TEST_DEAL_LABEL: '[TEST] Runner FULL smoke test 001',
        LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED: 'false',
      }),
    );

    expect(target.actualBitrixDealId).toBe(LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID);
    expect(target.testDealLabel).toBe('[TEST] Runner FULL smoke test 001');
  });
});

describe('trigger preflight with live smoke target', () => {
  it('uses actualBitrixDealId as payload bitrix_deal_id', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const target = resolveLiveSmokeTarget(
      fullInvoiceDryRunContext,
      parseLiveSmokeTargetConfig({
        LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        LIVE_TEST_DEAL_LABEL: '[TEST] Runner FULL smoke test 001',
      }),
    );
    const payload = buildBitrixTriggerPreflightPayload(contract, target);

    expect(payload.bitrix_deal_id).toBe(LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID);
    expect(payload.trigger_stage_id).toBe(BITRIX_PAID_STAGE_ID);
  });

  it('preflight report includes live smoke target fields and keeps request unsent', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const result = runBackendTriggerPreflight(
      contract,
      {
        baseUrl: 'http://localhost:3000',
        triggerPath: '/invoice-processes/bitrix-trigger',
        authHeaderName: 'x-api-key',
        authSecret: 'dummy-local-secret',
      },
      fullInvoiceDryRunContext,
      {
        LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
        LIVE_TEST_DEAL_LABEL: '[TEST] Runner FULL smoke test 001',
        LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED: 'false',
      },
    );

    expect(result.liveSmokeTarget.actualBitrixDealId).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(result.liveSmokeTarget.testDealLabel).toContain('[TEST]');
    expect(result.liveSmokeTarget.manualCrmPreparationConfirmed).toBe(false);
    expect(result.liveSmokeTarget.liveExecutionReady).toBe(false);
    expect(result.request.payload.bitrix_deal_id).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(result.execution.requestSent).toBe(false);
    expect(result.execution.endpointCalled).toBe(false);
    expect(result.execution.workflowExecuted).toBe(false);
    expect(result.execution.dbWriteExecuted).toBe(false);
  });
});

describe('live-smoke-target import boundary', () => {
  const root = join(__dirname);

  it('live-smoke-target sources do not import forbidden backend modules', () => {
    const files = [
      'live-smoke-target.types.ts',
      'parse-live-smoke-target-config.ts',
      'resolve-live-smoke-target.ts',
      'validate-live-smoke-target.ts',
    ];

    for (const file of files) {
      const content = readFileSync(join(root, file), 'utf8');
      const importLines = content
        .split('\n')
        .filter((line) => /^\s*import\s+/.test(line));

      for (const line of importLines) {
        for (const pattern of FORBIDDEN_LIVE_SMOKE_IMPORT_PATTERNS) {
          expect(line).not.toMatch(pattern);
        }
      }

      expect(content).not.toMatch(/\bfetch\s*\(/);
    }
  });
});
