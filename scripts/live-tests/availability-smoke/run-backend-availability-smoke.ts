import type { BackendAvailabilitySmokeConfig } from './backend-availability-smoke-config';
import {
  BackendHealthFetchTimeoutError,
  type BackendHealthFetchImpl,
  fetchBackendHealth,
} from './fetch-backend-health';
import {
  BACKEND_HEALTH_SMOKE_METHOD,
  DEFAULT_BACKEND_HEALTH_PATH,
  backendAvailabilitySmokeResultSchema,
  type BackendAvailabilitySmokeResult,
} from './backend-availability-smoke.types';

export interface RunBackendAvailabilitySmokeOptions {
  fetchImpl?: BackendHealthFetchImpl;
}

function buildSafetyFlags(): Pick<
  BackendAvailabilitySmokeResult,
  | 'externalSideEffectsExecuted'
  | 'workflowExecuted'
  | 'invoiceProcessCreated'
  | 'invoiceRecordCreated'
  | 'dbWriteExecuted'
  | 'bitrixCalled'
  | 'fakturowniaCalled'
  | 'ksefTested'
> {
  return {
    externalSideEffectsExecuted: false,
    workflowExecuted: false,
    invoiceProcessCreated: false,
    invoiceRecordCreated: false,
    dbWriteExecuted: false,
    bitrixCalled: false,
    fakturowniaCalled: false,
    ksefTested: false,
  };
}

export function buildNotConfiguredBackendAvailabilitySmoke(
  config: Partial<BackendAvailabilitySmokeConfig> = {},
): BackendAvailabilitySmokeResult {
  return buildBaseResult(
    {
      healthPath: DEFAULT_BACKEND_HEALTH_PATH,
      timeoutMs: config.timeoutMs ?? 5000,
      baseUrl: config.baseUrl,
    },
    {
      errors: config.baseUrl
        ? []
        : ['LIVE_TEST_BACKEND_BASE_URL is not configured'],
    },
  );
}

function buildBaseResult(
  config: BackendAvailabilitySmokeConfig,
  overrides: Partial<BackendAvailabilitySmokeResult> = {},
): BackendAvailabilitySmokeResult {
  const healthPath = config.healthPath || DEFAULT_BACKEND_HEALTH_PATH;

  return backendAvailabilitySmokeResultSchema.parse({
    mode: 'CONTROLLED_BACKEND_SMOKE',
    smokeKind: 'BACKEND_AVAILABILITY',
    target: {
      method: BACKEND_HEALTH_SMOKE_METHOD,
      path: healthPath,
      baseUrlConfigured: Boolean(config.baseUrl),
      endpointCalled: false,
    },
    request: {
      timeoutMs: config.timeoutMs,
    },
    resultStatus: 'BACKEND_HEALTH_NOT_CONFIGURED',
    warnings: [],
    errors: [],
    ...buildSafetyFlags(),
    ...overrides,
  });
}

/**
 * Controlled backend availability smoke: GET /health only.
 * Does not call invoice trigger or any workflow endpoint.
 */
export async function runBackendAvailabilitySmoke(
  config: BackendAvailabilitySmokeConfig,
  options: RunBackendAvailabilitySmokeOptions = {},
): Promise<BackendAvailabilitySmokeResult> {
  if (!config.baseUrl) {
    return buildBaseResult(config, {
      errors: ['LIVE_TEST_BACKEND_BASE_URL is not configured'],
    });
  }

  if (config.healthPath !== DEFAULT_BACKEND_HEALTH_PATH) {
    return buildBaseResult(config, {
      errors: [
        `LIVE_TEST_BACKEND_HEALTH_PATH must be ${DEFAULT_BACKEND_HEALTH_PATH} for controlled smoke`,
      ],
    });
  }

  try {
    const response = await fetchBackendHealth({
      baseUrl: config.baseUrl,
      healthPath: config.healthPath,
      timeoutMs: config.timeoutMs,
      fetchImpl: options.fetchImpl,
    });

    const passed = response.ok && response.statusCode >= 200 && response.statusCode < 300;

    return buildBaseResult(config, {
      target: {
        method: BACKEND_HEALTH_SMOKE_METHOD,
        path: config.healthPath,
        baseUrlConfigured: true,
        endpointCalled: true,
      },
      response: {
        statusCode: response.statusCode,
        ok: response.ok,
      },
      resultStatus: passed ? 'BACKEND_HEALTH_PASSED' : 'BACKEND_HEALTH_FAILED',
      errors: passed
        ? []
        : [`Backend health returned HTTP ${response.statusCode}`],
    });
  } catch (error: unknown) {
    if (error instanceof BackendHealthFetchTimeoutError) {
      return buildBaseResult(config, {
        target: {
          method: BACKEND_HEALTH_SMOKE_METHOD,
          path: config.healthPath,
          baseUrlConfigured: true,
          endpointCalled: true,
        },
        resultStatus: 'BACKEND_HEALTH_TIMEOUT',
        errors: [error.message],
      });
    }

    const message = error instanceof Error ? error.message : String(error);

    return buildBaseResult(config, {
      target: {
        method: BACKEND_HEALTH_SMOKE_METHOD,
        path: config.healthPath,
        baseUrlConfigured: true,
        endpointCalled: true,
      },
      resultStatus: 'BACKEND_HEALTH_FAILED',
      errors: [message],
    });
  }
}
