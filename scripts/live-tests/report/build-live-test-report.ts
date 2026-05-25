import type { LiveTestScenario, LiveTestScenarioResult } from '../scenarios/scenario.types';
import type { SafetyCheck } from '../types/live-test-report.types';
import {
  LIVE_TEST_RUNNER_VERSION,
  type LiveTestReport,
} from '../types/live-test-report.types';

export interface BuildLiveTestReportInput {
  scenario: LiveTestScenario;
  scenarioResult: LiveTestScenarioResult;
  safetyChecks: SafetyCheck[];
  startedAt: Date;
  finishedAt: Date;
}

export function buildLiveTestReport(input: BuildLiveTestReportInput): LiveTestReport {
  const { scenario, scenarioResult, safetyChecks, startedAt, finishedAt } =
    input;

  return {
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
    integrations: {
      ksef: 'MANUAL_REQUIRED',
      bitrixSync: 'NOT_TESTED_YET',
      bitrixDealSetup: 'NOT_RUN',
      backendWorkflow: 'NOT_RUN',
      fakturowniaOrder: 'NOT_RUN',
      fakturowniaInvoice: 'NOT_RUN',
      database: 'NOT_RUN',
    },
    scenario: {
      id: scenario.id,
      invoiceType: scenario.invoiceType,
      status: scenarioResult.status,
      steps: [],
      message: scenarioResult.message,
    },
    summary: `Live test skeleton completed for ${scenario.id} (${scenario.invoiceType}). Scenario implementation is pending.`,
  };
}
