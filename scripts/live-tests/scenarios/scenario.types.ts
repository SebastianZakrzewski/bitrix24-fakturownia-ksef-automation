import type { BackendDryRunResult } from '../adapters/backend-dry-run.types';
import type { BackendAvailabilitySmokeResult } from '../availability-smoke/backend-availability-smoke.types';
import type { BackendTriggerExecutionResult } from '../trigger-execution/backend-trigger-execution.types';
import type { BackendTriggerPreflightResult } from '../trigger-preflight/backend-trigger-preflight.types';
import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type {
  IntegrationStepStatus,
  LiveTestInvoiceType,
} from '../types/live-test-report.types';
import type { SafetyGuardContext } from '../safety-guards';

export type ScenarioRunStatus = 'DRY_RUN_COMPLETED' | 'PLACEHOLDER_SKIPPED' | 'FAILED';

export type LiveTestExecutionMode = 'DRY_RUN' | 'CONTROLLED_LIVE_TRIGGER_SMOKE';

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
  backendDryRun?: BackendDryRunResult;
  backendContract?: BackendDryRunContract;
  backendAvailabilitySmoke?: BackendAvailabilitySmokeResult;
  backendTriggerPreflight?: BackendTriggerPreflightResult;
  backendTriggerExecution?: BackendTriggerExecutionResult;
  steps: LiveTestScenarioStep[];
  message: string;
}

export interface LiveTestScenario {
  id: string;
  invoiceType: LiveTestInvoiceType;
  safetyContext: SafetyGuardContext;
  run(): Promise<LiveTestScenarioResult>;
}
