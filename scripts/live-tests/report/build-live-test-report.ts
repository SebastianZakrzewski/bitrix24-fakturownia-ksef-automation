import type { BackendDryRunResult } from '../adapters/backend-dry-run.types';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import { toBackendDryRunContractReport } from '../contracts/to-backend-contract-report';
import {
  parseBackendSmokeReadinessConfig,
  type BackendSmokeReadinessConfig,
} from '../smoke-readiness/backend-smoke-readiness-config';
import { checkBackendSmokeReadiness } from '../smoke-readiness/check-backend-smoke-readiness';
import { runBackendTriggerPreflight } from '../trigger-preflight/run-backend-trigger-preflight';
import { manualVerificationRequiredFromSystemEffects } from '../side-effects/derive-backend-trigger-system-effects';
import { RUNNER_DIRECT_SIDE_EFFECTS } from '../side-effects/live-test-side-effects.types';
import { buildBlockedBackendTriggerExecution } from '../trigger-execution/build-blocked-backend-trigger-execution';
import { toBackendTriggerExecutionReport } from '../trigger-execution/to-backend-trigger-execution-report';
import { toBackendTriggerPreflightReport } from '../trigger-preflight/to-backend-trigger-preflight-report';
import { buildNotConfiguredBackendAvailabilitySmoke } from '../availability-smoke/run-backend-availability-smoke';
import type { BackendSmokeReadinessResult } from '../smoke-readiness/backend-smoke-readiness.types';
import { BITRIX_PAID_STAGE_ID } from '../fixtures/fixture-common';
import { buildFixtureReportSummary } from '../fixtures/build-fixture-summary';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import { DRY_RUN_STEP_NAMES } from '../execution/dry-run-steps';
import type {
  LiveTestScenario,
  LiveTestScenarioResult,
  LiveTestScenarioStep,
} from '../scenarios/scenario.types';
import type { SafetyCheck, LiveTestReport } from '../types/live-test-report.types';
import { LIVE_TEST_RUNNER_VERSION } from '../types/live-test-report.types';

export interface BuildLiveTestReportInput {
  scenario: LiveTestScenario;
  scenarioResult: LiveTestScenarioResult;
  safetyChecks: SafetyCheck[];
  startedAt: Date;
  finishedAt: Date;
  reportWritten?: boolean;
  smokeReadinessConfig?: BackendSmokeReadinessConfig;
}

function buildMissingScenarioContext(
  scenarioType: LiveTestReport['meta']['invoiceType'],
): LiveTestScenarioContext {
  return {
    testContextId: 'missing',
    scenarioId: 'missing',
    scenarioType,
    invoiceType: scenarioType,
    testDealTitle: '[TEST] missing scenario context',
    bitrixDealId: '[TEST]-MISSING-001',
    idempotencyKey: '[TEST]-MISSING-001:FULL',
    paidStageId: BITRIX_PAID_STAGE_ID,
    paymentFormValueId: '718',
    buyer: {
      companyName: '[TEST] missing',
      nip: '1111111111',
      street: 'ul. Testowa 1',
      postalCode: '00-001',
      city: 'Warszawa',
      country: 'PL',
    },
    products: [],
    expectedExternalStepsSkipped: [],
    description: 'Missing scenario context placeholder for report build.',
  };
}

function buildMissingBackendTriggerPreflight(
  scenarioType: LiveTestReport['meta']['invoiceType'],
  config: BackendSmokeReadinessConfig,
): LiveTestReport['backendTriggerPreflight'] {
  const missingContext = buildMissingScenarioContext(scenarioType);

  return toBackendTriggerPreflightReport(
    runBackendTriggerPreflight(
      {
        mode: 'DRY_RUN',
        scenarioType,
        expectedInvoiceType: scenarioType,
        trigger: {
          bitrix_deal_id: missingContext.bitrixDealId,
          trigger_source: 'BITRIX24_STAGE_CHANGE',
          trigger_stage_id: missingContext.paidStageId,
          triggered_at: '1970-01-01T00:00:00.000Z',
        },
        fixtureContext: {
          fixtureId: 'missing',
          bitrixDealId: missingContext.bitrixDealId,
          hasSyntheticBuyer: false,
          hasProducts: false,
        },
        executionPolicy: {
          backendEndpointAllowed: false,
          useCaseExecutionAllowed: false,
          dbWriteAllowed: false,
          externalSideEffectsAllowed: false,
        },
      },
      config,
      missingContext,
      {},
    ),
  );
}

function buildMissingBackendSmokeReadiness(
  scenarioType: LiveTestReport['meta']['invoiceType'],
): BackendSmokeReadinessResult {
  return checkBackendSmokeReadiness({
    contract: {
      mode: 'DRY_RUN',
      scenarioType,
      expectedInvoiceType: scenarioType,
      trigger: {
        bitrix_deal_id: 'missing',
        trigger_source: 'BITRIX24_STAGE_CHANGE',
        trigger_stage_id: 'missing',
        triggered_at: '1970-01-01T00:00:00.000Z',
      },
      fixtureContext: {
        fixtureId: 'missing',
        bitrixDealId: 'missing',
        hasSyntheticBuyer: false,
        hasProducts: false,
      },
      executionPolicy: {
        backendEndpointAllowed: false,
        useCaseExecutionAllowed: false,
        dbWriteAllowed: false,
        externalSideEffectsAllowed: false,
      },
    },
    config: {},
  });
}

function toReportBackendContract(
  contract: BackendDryRunContract,
): LiveTestReport['backendContract'] {
  return toBackendDryRunContractReport(contract);
}

function toReportBackendDryRun(
  result: BackendDryRunResult,
): LiveTestReport['backendDryRun'] {
  return {
    backendMode: result.backendMode,
    backendWorkflowExecuted: result.backendWorkflowExecuted,
    backendEndpointCalled: result.backendEndpointCalled,
    useCaseExecuted: result.useCaseExecuted,
    invoiceProcessCreated: result.invoiceProcessCreated,
    invoiceRecordCreated: result.invoiceRecordCreated,
    invoiceEventCreated: result.invoiceEventCreated,
    dbWriteExecuted: result.dbWriteExecuted,
    validationSimulated: result.validationSimulated,
    mappedFromFixture: result.mappedFromFixture,
    resultStatus: result.resultStatus,
    scenarioType: result.scenarioType,
    expectedInvoiceType: result.expectedInvoiceType,
    testContextId: result.testContextId,
    bitrixDealId: result.bitrixDealId,
    notes: result.notes,
  };
}

function appendWriteReportStep(
  steps: LiveTestScenarioStep[],
  reportWritten: boolean,
): LiveTestScenarioStep[] {
  const writeStep: LiveTestScenarioStep = {
    name: DRY_RUN_STEP_NAMES.WRITE_REPORT,
    status: reportWritten ? 'PASSED' : 'NOT_RUN',
    message: reportWritten
      ? 'JSON and Markdown report written locally.'
      : 'Report not written yet.',
  };

  return [...steps, writeStep];
}

function resolveIntegrationStatuses(
  scenarioResult: LiveTestScenarioResult,
): LiveTestReport['integrations'] {
  const skipped = 'SKIPPED_NOT_EXECUTED' as const;

  if (scenarioResult.executionMode === 'CONTROLLED_LIVE_TRIGGER_SMOKE') {
    const triggerExecution = scenarioResult.backendTriggerExecution;
    const backendWorkflowStatus: LiveTestReport['integrations']['backendWorkflow'] =
      triggerExecution?.systemEffects.backendWorkflowMayHaveExecuted
        ? 'PASSED'
        : triggerExecution?.systemEffects.backendWorkflowExecutionAttempted
          ? 'FAILED'
          : 'NOT_RUN';

    return {
      ksef: 'MANUAL_REQUIRED',
      bitrixSync: 'NOT_TESTED_YET',
      bitrixDealSetup: skipped,
      backendWorkflow: backendWorkflowStatus,
      fakturowniaOrder: skipped,
      fakturowniaInvoice: skipped,
      database: skipped,
    };
  }

  if (scenarioResult.executionMode === 'DRY_RUN') {
    return {
      ksef: 'MANUAL_REQUIRED',
      bitrixSync: 'NOT_TESTED_YET',
      bitrixDealSetup: skipped,
      backendWorkflow: 'BACKEND_DRY_RUN_SIMULATED',
      fakturowniaOrder: skipped,
      fakturowniaInvoice: skipped,
      database: skipped,
    };
  }

  return {
    ksef: 'MANUAL_REQUIRED',
    bitrixSync: 'NOT_TESTED_YET',
    bitrixDealSetup: 'NOT_RUN',
    backendWorkflow: 'NOT_RUN',
    fakturowniaOrder: 'NOT_RUN',
    fakturowniaInvoice: 'NOT_RUN',
    database: 'NOT_RUN',
  };
}

export function buildLiveTestReport(input: BuildLiveTestReportInput): LiveTestReport {
  const {
    scenario,
    scenarioResult,
    safetyChecks,
    startedAt,
    finishedAt,
    reportWritten = false,
    smokeReadinessConfig,
  } = input;

  const resolvedSmokeConfig =
    smokeReadinessConfig ?? parseBackendSmokeReadinessConfig(process.env);
  const backendSmokeReadiness = scenarioResult.backendContract
    ? checkBackendSmokeReadiness({
        contract: scenarioResult.backendContract,
        config: resolvedSmokeConfig,
      })
    : buildMissingBackendSmokeReadiness(scenario.invoiceType);

  const steps = appendWriteReportStep(scenarioResult.steps, reportWritten);
  const mode =
    scenarioResult.executionMode === 'CONTROLLED_LIVE_TRIGGER_SMOKE'
      ? 'CONTROLLED_LIVE_TRIGGER_SMOKE'
      : 'DRY_RUN';
  const backendTriggerExecutionReport = scenarioResult.backendTriggerExecution
    ? toBackendTriggerExecutionReport(scenarioResult.backendTriggerExecution)
    : buildBlockedBackendTriggerExecution(scenario.invoiceType);
  const manualVerificationRequired =
    mode === 'CONTROLLED_LIVE_TRIGGER_SMOKE'
      ? manualVerificationRequiredFromSystemEffects(
          backendTriggerExecutionReport.systemEffects,
        )
      : false;

  return {
    mode,
    meta: {
      scenarioId: scenario.id,
      invoiceType: scenario.invoiceType,
      runnerVersion: LIVE_TEST_RUNNER_VERSION,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    },
    safety: {
      passed: safetyChecks.every(
        (check) => check.status === 'passed' || check.status === 'skipped',
      ),
      checks: safetyChecks,
    },
    productionReadiness: 'NOT_READY',
    ksefStatus: 'MANUAL_REQUIRED',
    bitrixSyncStatus: 'NOT_TESTED_YET',
    runnerDirectSideEffects: RUNNER_DIRECT_SIDE_EFFECTS,
    runnerDirectExternalSideEffectsExecuted: false,
    manualVerificationRequired,
    backendTriggerExecution: backendTriggerExecutionReport,
    backendAvailabilitySmoke:
      scenarioResult.backendAvailabilitySmoke ??
      buildNotConfiguredBackendAvailabilitySmoke(),
    backendTriggerPreflight: scenarioResult.backendTriggerPreflight
      ? toBackendTriggerPreflightReport(scenarioResult.backendTriggerPreflight)
      : buildMissingBackendTriggerPreflight(
          scenario.invoiceType,
          resolvedSmokeConfig,
        ),
    backendSmokeReadiness,
    backendContract: scenarioResult.backendContract
      ? toReportBackendContract(scenarioResult.backendContract)
      : {
          mode: 'DRY_RUN',
          scenarioType: scenario.invoiceType,
          expectedInvoiceType: scenario.invoiceType,
          trigger: {
            bitrix_deal_id: 'missing',
            trigger_source: 'BITRIX24_STAGE_CHANGE',
            trigger_stage_id: 'missing',
            triggered_at: '1970-01-01T00:00:00.000Z',
          },
          executionPolicy: {
            backendEndpointAllowed: false,
            useCaseExecutionAllowed: false,
            dbWriteAllowed: false,
            externalSideEffectsAllowed: false,
          },
          contractValidationStatus: 'PASSED',
        },
    backendDryRun: scenarioResult.backendDryRun
      ? toReportBackendDryRun(scenarioResult.backendDryRun)
      : {
      backendMode: 'DRY_RUN',
      backendWorkflowExecuted: false,
      backendEndpointCalled: false,
      useCaseExecuted: false,
      invoiceProcessCreated: false,
      invoiceRecordCreated: false,
      invoiceEventCreated: false,
      dbWriteExecuted: false,
      validationSimulated: true,
      mappedFromFixture: true,
      resultStatus: 'BACKEND_DRY_RUN_SIMULATED',
      scenarioType: scenario.invoiceType,
      expectedInvoiceType: scenario.invoiceType,
      testContextId: 'missing',
      bitrixDealId: 'missing',
      notes: ['Backend dry-run result missing from scenario output.'],
    },
    fixture: scenarioResult.context
      ? buildFixtureReportSummary(scenarioResult.context)
      : {
          testContextId: 'missing',
          scenarioType: scenario.invoiceType,
          bitrixDealId: 'missing',
          expectedInvoiceType: scenario.invoiceType,
          paidStageId: 'missing',
          buyerSummary: {
            companyName: 'missing',
            nipMasked: 'TEST-****',
            city: 'missing',
            country: 'PL',
          },
          productSummary: [],
          expectedExternalStepsSkipped: [],
        },
    integrations: resolveIntegrationStatuses(scenarioResult),
    scenario: {
      id: scenario.id,
      invoiceType: scenario.invoiceType,
      status: scenarioResult.status,
      steps,
      context: scenarioResult.context
        ? {
            testContextId: scenarioResult.context.testContextId,
            testDealTitle: scenarioResult.context.testDealTitle,
            bitrixDealId: scenarioResult.context.bitrixDealId,
            idempotencyKey: scenarioResult.context.idempotencyKey,
          }
        : undefined,
      message: scenarioResult.message,
    },
    summary:
      scenarioResult.executionMode === 'CONTROLLED_LIVE_TRIGGER_SMOKE'
        ? `Controlled live trigger smoke completed for ${scenario.id} (${scenario.invoiceType}). Runner external side effects remain false; manual verification is required.`
        : scenarioResult.executionMode === 'DRY_RUN'
          ? `Dry-run live test completed for ${scenario.id} (${scenario.invoiceType}). External side effects were not executed.`
          : `Live test completed for ${scenario.id} (${scenario.invoiceType}).`,
  };
}
