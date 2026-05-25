import type { LiveTestInvoiceType } from '../types/live-test-report.types';
import type { SafetyGuardContext } from '../safety-guards';

export type ScenarioRunStatus = 'PLACEHOLDER_SKIPPED';

export interface LiveTestScenarioResult {
  status: ScenarioRunStatus;
  message: string;
}

export interface LiveTestScenario {
  id: string;
  invoiceType: LiveTestInvoiceType;
  safetyContext: SafetyGuardContext;
  run(): Promise<LiveTestScenarioResult>;
}
