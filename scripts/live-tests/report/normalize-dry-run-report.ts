import type { LiveTestReport } from '../types/live-test-report.types';

export interface NormalizedDryRunReport {
  mode: LiveTestReport['mode'];
  meta: {
    scenarioId: string;
    invoiceType: LiveTestReport['meta']['invoiceType'];
  };
  safetyPassed: boolean;
  safetyCheckCodes: string[];
  productionReadiness: LiveTestReport['productionReadiness'];
  ksefStatus: LiveTestReport['ksefStatus'];
  bitrixSyncStatus: LiveTestReport['bitrixSyncStatus'];
  externalSideEffectsExecuted: false;
  backendContract: LiveTestReport['backendContract'];
  backendDryRun: LiveTestReport['backendDryRun'];
  fixture: LiveTestReport['fixture'];
  integrations: LiveTestReport['integrations'];
  scenario: {
    id: string;
    invoiceType: LiveTestReport['scenario']['invoiceType'];
    status: LiveTestReport['scenario']['status'];
    stepStatuses: Record<string, string>;
    context?: LiveTestReport['scenario']['context'];
  };
}

export function isIso8601Timestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function normalizeDryRunReport(report: LiveTestReport): NormalizedDryRunReport {
  const stepStatuses: Record<string, string> = {};
  for (const step of report.scenario.steps) {
    stepStatuses[step.name] = step.status;
  }

  return {
    mode: report.mode,
    meta: {
      scenarioId: report.meta.scenarioId,
      invoiceType: report.meta.invoiceType,
    },
    safetyPassed: report.safety.passed,
    safetyCheckCodes: report.safety.checks.map((check) => check.code).sort(),
    productionReadiness: report.productionReadiness,
    ksefStatus: report.ksefStatus,
    bitrixSyncStatus: report.bitrixSyncStatus,
    externalSideEffectsExecuted: false,
    backendContract: report.backendContract,
    backendDryRun: report.backendDryRun,
    fixture: report.fixture,
    integrations: report.integrations,
    scenario: {
      id: report.scenario.id,
      invoiceType: report.scenario.invoiceType,
      status: report.scenario.status,
      stepStatuses,
      context: report.scenario.context,
    },
  };
}

export function compareNormalizedDryRunReports(
  left: NormalizedDryRunReport,
  right: NormalizedDryRunReport,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
