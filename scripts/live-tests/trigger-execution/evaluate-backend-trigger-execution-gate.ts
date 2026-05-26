import { hasTestDealPrefix } from '../fixtures/fixture-common';
import type { LiveTestEnv } from '../live-test-env';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { parseLiveSmokeTargetConfig } from '../live-smoke-target/parse-live-smoke-target-config';
import { resolveLiveSmokeTarget } from '../live-smoke-target/resolve-live-smoke-target';
import { validateLiveSmokeTarget } from '../live-smoke-target/validate-live-smoke-target';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import { parseBackendTriggerExecutionConfig } from './backend-trigger-execution-config';
import { BACKEND_TRIGGER_EXECUTION_PATH } from './backend-trigger-execution.types';

export interface BackendTriggerExecutionGateResult {
  executionAllowed: boolean;
  triggerExecutionAllowed: boolean;
  blockers: string[];
  warnings: string[];
}

function requireTrue(
  condition: boolean,
  blockers: string[],
  message: string,
): void {
  if (!condition) {
    blockers.push(message);
  }
}

function requireFalse(
  condition: boolean,
  blockers: string[],
  message: string,
): void {
  if (condition) {
    blockers.push(message);
  }
}

/**
 * Evaluates whether a single POST /invoice-processes/bitrix-trigger may be sent.
 * Default is blocked unless every documented flag and live smoke target rule passes.
 */
export function evaluateBackendTriggerExecutionGate(
  env: LiveTestEnv,
  context: LiveTestScenarioContext,
  rawConfig: Record<string, string | undefined> = process.env,
): BackendTriggerExecutionGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Controlled trigger execution sends at most one POST per runner invocation.',
  ];

  const allowFlag = rawConfig.LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION?.trim() === 'true';

  requireTrue(env.LIVE_TEST_MODE, blockers, 'LIVE_TEST_MODE must be true');
  requireTrue(env.LIVE_TEST_CONFIRM, blockers, 'LIVE_TEST_CONFIRM must be true');
  requireTrue(
    env.ENABLE_EXTERNAL_SIDE_EFFECTS,
    blockers,
    'ENABLE_EXTERNAL_SIDE_EFFECTS must be true',
  );
  requireTrue(
    allowFlag,
    blockers,
    'LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION must be true',
  );
  requireFalse(
    env.ALLOW_TEST_DEAL_CREATION,
    blockers,
    'ALLOW_TEST_DEAL_CREATION must be false',
  );
  requireFalse(
    env.ALLOW_BULK_LIVE_TESTS,
    blockers,
    'ALLOW_BULK_LIVE_TESTS must be false',
  );
  requireFalse(
    env.ALLOW_DELETE_OR_CANCEL,
    blockers,
    'ALLOW_DELETE_OR_CANCEL must be false',
  );

  const liveSmokeTarget = resolveLiveSmokeTarget(context, parseLiveSmokeTargetConfig(rawConfig));
  const targetValidation = validateLiveSmokeTarget({
    target: liveSmokeTarget,
    scenarioType: context.scenarioType,
  });

  if (!targetValidation.valid) {
    blockers.push(...targetValidation.errors);
  }

  if (!liveSmokeTarget.manualCrmPreparationConfirmed) {
    blockers.push('LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED must be true');
  }

  if (!hasTestDealPrefix(liveSmokeTarget.testDealLabel)) {
    blockers.push('LIVE_TEST_DEAL_LABEL must start with [TEST]');
  }

  if (liveSmokeTarget.actualBitrixDealId !== LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID) {
    blockers.push(
      `LIVE_TEST_ACTUAL_BITRIX_DEAL_ID must be ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID} for controlled trigger smoke V1`,
    );
  }

  if (liveSmokeTarget.expectedTriggerStageId !== 'PREPARATION') {
    blockers.push('expectedTriggerStageId must be PREPARATION for controlled trigger smoke V1');
  }

  const backendConfig = parseBackendTriggerExecutionConfig(rawConfig);
  if (!backendConfig.baseUrl) {
    blockers.push('LIVE_TEST_BACKEND_BASE_URL is not configured');
  }

  if (!backendConfig.authHeaderName) {
    blockers.push('LIVE_TEST_BACKEND_AUTH_HEADER_NAME is not configured');
  }

  if (!backendConfig.authSecret) {
    blockers.push(
      'LIVE_TEST_BACKEND_AUTH_SECRET or N8N_API_KEY must be configured for backend trigger auth',
    );
  }

  if (backendConfig.triggerPath !== BACKEND_TRIGGER_EXECUTION_PATH) {
    blockers.push(
      `LIVE_TEST_BACKEND_TRIGGER_PATH must be ${BACKEND_TRIGGER_EXECUTION_PATH}`,
    );
  }

  const executionAllowed = blockers.length === 0;

  return {
    executionAllowed,
    triggerExecutionAllowed: executionAllowed,
    blockers,
    warnings,
  };
}
