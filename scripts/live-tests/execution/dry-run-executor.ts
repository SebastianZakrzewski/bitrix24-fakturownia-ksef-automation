import { simulateBackendDryRunWorkflow } from '../adapters/backend-dry-run.adapter';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type {
  LiveTestScenarioResult,
  LiveTestScenarioStep,
} from '../scenarios/scenario.types';
import { DRY_RUN_STEP_NAMES } from './dry-run-steps';

export interface ExecuteDryRunScenarioInput {
  context: LiveTestScenarioContext;
}

function step(
  name: string,
  status: LiveTestScenarioStep['status'],
  message: string,
): LiveTestScenarioStep {
  return { name, status, message };
}

export async function executeDryRunScenario(
  input: ExecuteDryRunScenarioInput,
): Promise<LiveTestScenarioResult> {
  const { context } = input;
  const backendDryRun = simulateBackendDryRunWorkflow(context);

  const steps: LiveTestScenarioStep[] = [
    step(
      DRY_RUN_STEP_NAMES.VALIDATE_SAFETY_GUARDS,
      'PASSED',
      'Safety guards validated before dry-run execution (no external side effects).',
    ),
    step(
      DRY_RUN_STEP_NAMES.PREPARE_TEST_CONTEXT,
      'PASSED',
      `Prepared local fixture ${context.testContextId} for ${context.invoiceType} (${context.testDealTitle}).`,
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP,
      'SKIPPED_NOT_EXECUTED',
      'Bitrix24 test deal setup was not executed in dry-run mode.',
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_BACKEND_WORKFLOW,
      'BACKEND_DRY_RUN_SIMULATED',
      'Backend workflow was simulated locally; no endpoint, use case, or DB write occurred.',
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_FAKTUROWNIA_ORDER_INVOICE,
      'SKIPPED_NOT_EXECUTED',
      'Fakturownia order/invoice creation was not executed in dry-run mode.',
    ),
    step(
      DRY_RUN_STEP_NAMES.MARK_KSEF,
      'MANUAL_REQUIRED',
      'KSeF verification remains manual in V1 (Fakturownia handles submission).',
    ),
    step(
      DRY_RUN_STEP_NAMES.MARK_BITRIX_SYNC,
      'NOT_TESTED_YET',
      'Bitrix sync is excluded from current live-test scope.',
    ),
  ];

  return {
    status: 'DRY_RUN_COMPLETED',
    executionMode: 'DRY_RUN',
    externalSideEffectsExecuted: false,
    context,
    backendDryRun,
    steps,
    message: `Dry-run completed for ${context.scenarioId} (${context.invoiceType}). Backend workflow was simulated only; no external systems were called.`,
  };
}
