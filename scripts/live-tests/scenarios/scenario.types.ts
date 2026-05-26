import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type {
  IntegrationStepStatus,
  LiveTestInvoiceType,
} from '../types/live-test-report.types';
import type { SafetyGuardContext } from '../safety-guards';

export type ScenarioRunStatus = 'DRY_RUN_COMPLETED' | 'PLACEHOLDER_SKIPPED' | 'FAILED';

export type LiveTestExecutionMode = 'dry-run';

export interface LiveTestScenarioStep {
  name: string;
  status: IntegrationStepStatus;
  message?: string;
}

export interface LiveTestScenarioResult {
  status: ScenarioRunStatus;
  executionMode?: LiveTestExecutionMode;
  externalSideEffectsExecuted: boolean;
  context?: LiveTestScenarioContext;
  steps: LiveTestScenarioStep[];
  message: string;
}

export interface LiveTestScenario {
  id: string;
  invoiceType: LiveTestInvoiceType;
  safetyContext: SafetyGuardContext;
  run(): Promise<LiveTestScenarioResult>;
}
