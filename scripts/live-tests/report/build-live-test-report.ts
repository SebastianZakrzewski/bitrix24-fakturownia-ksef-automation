import type { BackendDryRunResult } from '../adapters/backend-dry-run.types';
import { buildFixtureReportSummary } from '../fixtures/build-fixture-summary';
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
  } = input;

  const steps = appendWriteReportStep(scenarioResult.steps, reportWritten);
  const mode = 'DRY_RUN' as const;

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
    externalSideEffectsExecuted: false,
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
      scenarioResult.executionMode === 'DRY_RUN'
        ? `Dry-run live test completed for ${scenario.id} (${scenario.invoiceType}). External side effects were not executed.`
        : `Live test completed for ${scenario.id} (${scenario.invoiceType}).`,
  };
}
