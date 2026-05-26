import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
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
): BackendTriggerPreflightResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Trigger request was prepared locally but not sent.',
    'POST /invoice-processes/bitrix-trigger was not called.',
  ];

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
    payload = buildBitrixTriggerPreflightPayload(contract);
    const validation = validateBackendTriggerPreflightPayload(contract, payload);
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
    preflightStatus,
    blockers,
    warnings,
  };

  return backendTriggerPreflightResultSchema.parse(result);
}
