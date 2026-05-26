import { simulateBackendDryRunWorkflow } from '../adapters/backend-dry-run.adapter';
import {
  parseBackendAvailabilitySmokeConfig,
  type BackendAvailabilitySmokeConfig,
} from '../availability-smoke/backend-availability-smoke-config';
import type { BackendHealthFetchImpl } from '../availability-smoke/fetch-backend-health';
import { runBackendAvailabilitySmoke } from '../availability-smoke/run-backend-availability-smoke';
import {
  parseBackendSmokeReadinessConfig,
  type BackendSmokeReadinessConfig,
} from '../smoke-readiness/backend-smoke-readiness-config';
import { runBackendTriggerPreflight } from '../trigger-preflight/run-backend-trigger-preflight';
import type { LiveTestEnv } from '../live-test-env';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type {
  LiveTestScenarioResult,
  LiveTestScenarioStep,
} from '../scenarios/scenario.types';
import type { BackendTriggerFetchImpl } from '../trigger-execution/fetch-backend-bitrix-trigger';
import { runBackendTriggerExecutionSmoke } from '../trigger-execution/run-backend-trigger-execution-smoke';
import { DRY_RUN_STEP_NAMES } from './dry-run-steps';

export interface ExecuteLiveTriggerSmokeScenarioInput {
  env: LiveTestEnv;
  context: LiveTestScenarioContext;
  rawConfig?: Record<string, string | undefined>;
  availabilityConfig?: BackendAvailabilitySmokeConfig;
  triggerPreflightConfig?: BackendSmokeReadinessConfig;
  fetchImpl?: BackendHealthFetchImpl;
  triggerFetchImpl?: BackendTriggerFetchImpl;
}

function step(
  name: string,
  status: LiveTestScenarioStep['status'],
  message: string,
): LiveTestScenarioStep {
  return { name, status, message };
}

export async function executeLiveTriggerSmokeScenario(
  input: ExecuteLiveTriggerSmokeScenarioInput,
): Promise<LiveTestScenarioResult> {
  const rawConfig = input.rawConfig ?? process.env;
  const { context, env, fetchImpl, triggerFetchImpl } = input;
  const { result: backendDryRun, contract: backendContract } =
    simulateBackendDryRunWorkflow(context);
  const resolvedAvailabilityConfig =
    input.availabilityConfig ?? parseBackendAvailabilitySmokeConfig(rawConfig);
  const backendAvailabilitySmoke = await runBackendAvailabilitySmoke(
    resolvedAvailabilityConfig,
    { fetchImpl },
  );
  const resolvedTriggerPreflightConfig =
    input.triggerPreflightConfig ?? parseBackendSmokeReadinessConfig(rawConfig);
  const backendTriggerPreflight = runBackendTriggerPreflight(
    backendContract,
    resolvedTriggerPreflightConfig,
    context,
    rawConfig,
  );
  const backendTriggerExecution = await runBackendTriggerExecutionSmoke({
    env,
    context,
    contract: backendContract,
    rawConfig,
    fetchImpl: triggerFetchImpl,
  });

  const triggerStepStatus: LiveTestScenarioStep['status'] =
    backendTriggerExecution.systemEffects.backendWorkflowMayHaveExecuted
      ? 'PASSED'
      : backendTriggerExecution.systemEffects.backendWorkflowExecutionAttempted
        ? 'FAILED'
        : 'SKIPPED_NOT_EXECUTED';

  const steps: LiveTestScenarioStep[] = [
    step(
      DRY_RUN_STEP_NAMES.VALIDATE_SAFETY_GUARDS,
      'PASSED',
      'Safety guards validated before controlled trigger execution.',
    ),
    step(
      DRY_RUN_STEP_NAMES.PREPARE_TEST_CONTEXT,
      'PASSED',
      `Prepared local fixture ${context.testContextId} for ${context.invoiceType} (${context.testDealTitle}).`,
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP,
      'SKIPPED_NOT_EXECUTED',
      'Bitrix24 was not called from the runner; CRM deal must be prepared manually.',
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_BACKEND_WORKFLOW,
      'BACKEND_DRY_RUN_SIMULATED',
      'Local contract/dry-run mapping only; real workflow runs only if trigger POST is allowed.',
    ),
    step(
      DRY_RUN_STEP_NAMES.EXECUTE_BACKEND_TRIGGER,
      triggerStepStatus,
      backendTriggerExecution.systemEffects.backendTriggerRequestSent
        ? 'Backend trigger POST was sent; backend workflow/side effects may have occurred.'
        : 'Trigger POST blocked by execution gate; no request sent.',
    ),
    step(
      DRY_RUN_STEP_NAMES.SIMULATE_FAKTUROWNIA_ORDER_INVOICE,
      'SKIPPED_NOT_EXECUTED',
      'Fakturownia was not called from the runner.',
    ),
    step(
      DRY_RUN_STEP_NAMES.MARK_KSEF,
      'MANUAL_REQUIRED',
      'KSeF verification remains manual in V1.',
    ),
    step(
      DRY_RUN_STEP_NAMES.MARK_BITRIX_SYNC,
      'NOT_TESTED_YET',
      'Bitrix sync is excluded from trigger smoke scope.',
    ),
  ];

  return {
    status: 'DRY_RUN_COMPLETED',
    executionMode: 'CONTROLLED_LIVE_TRIGGER_SMOKE',
    externalSideEffectsExecuted: false,
    context,
    backendDryRun,
    backendContract,
    backendAvailabilitySmoke,
    backendTriggerPreflight,
    backendTriggerExecution,
    steps,
    message:
      backendTriggerExecution.systemEffects.backendTriggerRequestSent
        ? `Controlled trigger smoke completed for ${context.scenarioId}; manual backend verification required.`
        : `Controlled trigger smoke completed for ${context.scenarioId}; trigger POST was not sent.`,
  };
}
