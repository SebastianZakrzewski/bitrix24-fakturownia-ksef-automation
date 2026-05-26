import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { BackendSmokeReadinessConfig } from './backend-smoke-readiness-config';
import { assessBitrixTriggerContractCompatibility } from './assess-bitrix-trigger-contract-compatibility';
import { maskBackendBaseUrl } from './mask-backend-base-url';
import {
  BACKEND_SMOKE_TRIGGER_ENDPOINT_NAME,
  BACKEND_SMOKE_TRIGGER_METHOD,
  BACKEND_SMOKE_TRIGGER_PATH,
  backendSmokeReadinessResultSchema,
  type BackendSmokeReadinessResult,
} from './backend-smoke-readiness.types';

export interface CheckBackendSmokeReadinessInput {
  contract: BackendDryRunContract;
  config: BackendSmokeReadinessConfig;
}

export function checkBackendSmokeReadiness(
  input: CheckBackendSmokeReadinessInput,
): BackendSmokeReadinessResult {
  const { contract, config } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  const baseUrlConfigured = Boolean(config.baseUrl);
  if (!baseUrlConfigured) {
    blockers.push('LIVE_TEST_BACKEND_BASE_URL is not configured');
  }

  const headerNameConfigured = Boolean(config.authHeaderName);
  if (!headerNameConfigured) {
    blockers.push('LIVE_TEST_BACKEND_AUTH_HEADER_NAME is not configured');
  }

  const secretConfigured = Boolean(config.authSecret);
  if (!secretConfigured) {
    blockers.push(
      'LIVE_TEST_BACKEND_AUTH_SECRET or N8N_API_KEY must be configured for backend trigger auth',
    );
  }

  const configuredPath = config.triggerPath ?? BACKEND_SMOKE_TRIGGER_PATH;
  if (configuredPath !== BACKEND_SMOKE_TRIGGER_PATH) {
    blockers.push(
      `LIVE_TEST_BACKEND_TRIGGER_PATH must be ${BACKEND_SMOKE_TRIGGER_PATH}`,
    );
  }

  const contractAssessment = assessBitrixTriggerContractCompatibility(contract);
  if (contractAssessment.contractValidationStatus === 'FAILED') {
    blockers.push('Backend dry-run contract is not compatible with BitrixTriggerRequestDto');
  }

  if (baseUrlConfigured && config.baseUrl) {
    try {
      new URL(config.baseUrl);
    } catch {
      blockers.push('LIVE_TEST_BACKEND_BASE_URL is not a valid URL');
    }
  }

  const readinessStatus =
    blockers.length === 0
      ? 'READY_FOR_CONTROLLED_BACKEND_SMOKE'
      : 'NOT_READY_FOR_BACKEND_SMOKE';

  const result: BackendSmokeReadinessResult = {
    mode: 'DRY_RUN',
    readinessKind: 'BACKEND_SMOKE_READINESS',
    scenarioType: contract.scenarioType,
    target: {
      endpointName: BACKEND_SMOKE_TRIGGER_ENDPOINT_NAME,
      method: BACKEND_SMOKE_TRIGGER_METHOD,
      path: BACKEND_SMOKE_TRIGGER_PATH,
      baseUrlConfigured,
      baseUrlMasked:
        baseUrlConfigured && config.baseUrl
          ? maskBackendBaseUrl(config.baseUrl)
          : undefined,
      endpointCallAllowed: false,
      endpointCalled: false,
    },
    auth: {
      required: true,
      headerNameConfigured,
      secretConfigured,
      secretDisplayed: false,
    },
    contract: contractAssessment,
    executionPolicy: {
      backendEndpointAllowed: false,
      useCaseExecutionAllowed: false,
      dbWriteAllowed: false,
      externalSideEffectsAllowed: false,
    },
    readinessStatus,
    blockers,
    warnings,
  };

  return backendSmokeReadinessResultSchema.parse(result);
}
