import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import {
  MANUAL_CRM_PREPARATION_REQUIREMENTS,
} from '../live-smoke-target/live-smoke-target.types';
import { parseLiveSmokeTargetConfig } from '../live-smoke-target/parse-live-smoke-target-config';
import { resolveLiveSmokeTarget } from '../live-smoke-target/resolve-live-smoke-target';
import { validateLiveSmokeTarget } from '../live-smoke-target/validate-live-smoke-target';
import type { BackendSmokeReadinessConfig } from '../smoke-readiness/backend-smoke-readiness-config';
import { BACKEND_SMOKE_TRIGGER_PATH } from '../smoke-readiness/backend-smoke-readiness.types';
import { buildBitrixTriggerPreflightPayload } from './build-bitrix-trigger-preflight-payload';
import { validateBackendTriggerPreflightPayload } from './validate-backend-trigger-preflight-payload';
import {
  BACKEND_TRIGGER_PREFLIGHT_METHOD,
  BACKEND_TRIGGER_PREFLIGHT_PATH,
  backendTriggerPreflightResultSchema,
  type BackendTriggerPreflightResult,
  type BackendTriggerPreflightStatus,
} from './backend-trigger-preflight.types';

function buildSafetyExecution(): BackendTriggerPreflightResult['execution'] {
  return {
    requestSent: false,
    endpointCalled: false,
    workflowExecuted: false,
    invoiceProcessCreated: false,
    invoiceRecordCreated: false,
    dbWriteExecuted: false,
    bitrixCalled: false,
    fakturowniaCalled: false,
    ksefTested: false,
  };
}

function buildExecutionPolicy(): BackendTriggerPreflightResult['executionPolicy'] {
  return {
    triggerExecutionAllowed: false,
    backendEndpointAllowed: false,
    useCaseExecutionAllowed: false,
    dbWriteAllowed: false,
    externalSideEffectsAllowed: false,
  };
}

function resolvePreflightStatus(
  blockers: string[],
  payloadValid: boolean,
): BackendTriggerPreflightStatus {
  if (blockers.length > 0) {
    return 'BACKEND_TRIGGER_PREFLIGHT_NOT_READY';
  }

  if (!payloadValid) {
    return 'BACKEND_TRIGGER_PREFLIGHT_FAILED';
  }

  return 'BACKEND_TRIGGER_PREFLIGHT_PASSED';
}

/**
 * Prepares backend trigger request metadata without sending POST /invoice-processes/bitrix-trigger.
 */
export function runBackendTriggerPreflight(
  contract: BackendDryRunContract,
  config: BackendSmokeReadinessConfig,
  context: LiveTestScenarioContext,
  env: Record<string, string | undefined> = process.env,
): BackendTriggerPreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Trigger request was prepared locally but not sent.',
    'POST /invoice-processes/bitrix-trigger was not called.',
  ];

  const liveSmokeTarget = resolveLiveSmokeTarget(
    context,
    parseLiveSmokeTargetConfig(env),
  );
  const liveSmokeTargetValidation = validateLiveSmokeTarget({
    target: liveSmokeTarget,
    scenarioType: contract.scenarioType,
  });

  if (!liveSmokeTargetValidation.liveExecutionReady) {
    warnings.push(
      'Live execution not ready: manual CRM preparation is not confirmed.',
    );
    warnings.push(...MANUAL_CRM_PREPARATION_REQUIREMENTS);
  }

  const baseUrlConfigured = Boolean(config.baseUrl);
  const authHeaderNameConfigured = Boolean(config.authHeaderName);
  const authSecretConfigured = Boolean(config.authSecret);

  if (!baseUrlConfigured) {
    blockers.push('LIVE_TEST_BACKEND_BASE_URL is not configured');
  }

  if (!authHeaderNameConfigured) {
    blockers.push('LIVE_TEST_BACKEND_AUTH_HEADER_NAME is not configured');
  }

  if (!authSecretConfigured) {
    blockers.push('LIVE_TEST_BACKEND_AUTH_SECRET is not configured');
  }

  const configuredPath = config.triggerPath ?? BACKEND_SMOKE_TRIGGER_PATH;
  if (configuredPath !== BACKEND_TRIGGER_PREFLIGHT_PATH) {
    blockers.push(
      `LIVE_TEST_BACKEND_TRIGGER_PATH must be ${BACKEND_TRIGGER_PREFLIGHT_PATH} for trigger preflight metadata`,
    );
  }

  let payload = contract.trigger;
  let payloadShapeValid = false;

  try {
    payload = buildBitrixTriggerPreflightPayload(contract, liveSmokeTarget);
    const validation = validateBackendTriggerPreflightPayload(
      contract,
      liveSmokeTarget,
      liveSmokeTargetValidation,
      payload,
    );
    payloadShapeValid = validation.valid;

    if (!validation.valid) {
      warnings.push(...validation.errors);
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    warnings.push(`Payload build failed: ${message}`);
  }

  const preflightStatus = resolvePreflightStatus(blockers, payloadShapeValid);

  const result: BackendTriggerPreflightResult = {
    mode: 'CONTROLLED_BACKEND_PREFLIGHT',
    preflightKind: 'BACKEND_TRIGGER_PREFLIGHT',
    scenarioType: contract.scenarioType,
    target: {
      method: BACKEND_TRIGGER_PREFLIGHT_METHOD,
      path: BACKEND_TRIGGER_PREFLIGHT_PATH,
      baseUrlConfigured,
      authHeaderNameConfigured,
      authSecretConfigured,
      secretDisplayed: false,
    },
    request: {
      payloadShapeValid,
      payload,
    },
    executionPolicy: buildExecutionPolicy(),
    execution: buildSafetyExecution(),
    liveSmokeTarget: {
      actualBitrixDealId: liveSmokeTarget.actualBitrixDealId,
      testDealLabel: liveSmokeTarget.testDealLabel,
      testDealLabelStartsWithTestPrefix:
        liveSmokeTargetValidation.testDealLabelStartsWithTestPrefix,
      manualCrmPreparationConfirmed: liveSmokeTarget.manualCrmPreparationConfirmed,
      expectedScenarioType: liveSmokeTarget.expectedScenarioType,
      expectedTriggerStageId: liveSmokeTarget.expectedTriggerStageId,
      liveSmokeTargetValid: liveSmokeTargetValidation.valid,
      liveExecutionReady: liveSmokeTargetValidation.liveExecutionReady,
      manualCrmPreparationRequirements: [...MANUAL_CRM_PREPARATION_REQUIREMENTS],
    },
    preflightStatus,
    blockers,
    warnings,
  };

  return backendTriggerPreflightResultSchema.parse(result);
}
