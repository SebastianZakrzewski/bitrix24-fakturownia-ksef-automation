import {
  DEFAULT_BACKEND_HEALTH_PATH,
  DEFAULT_BACKEND_HEALTH_TIMEOUT_MS,
} from './backend-availability-smoke.types';

export interface BackendAvailabilitySmokeConfig {
  baseUrl?: string;
  healthPath: string;
  timeoutMs: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value?.trim()) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

/**
 * Missing LIVE_TEST_BACKEND_BASE_URL yields BACKEND_HEALTH_NOT_CONFIGURED without HTTP.
 */
export function parseBackendAvailabilitySmokeConfig(
  config: Record<string, string | undefined> = process.env,
): BackendAvailabilitySmokeConfig {
  const baseUrl = config.LIVE_TEST_BACKEND_BASE_URL?.trim();
  const healthPath =
    config.LIVE_TEST_BACKEND_HEALTH_PATH?.trim() || DEFAULT_BACKEND_HEALTH_PATH;

  return {
    baseUrl: baseUrl || undefined,
    healthPath,
    timeoutMs: parsePositiveInt(
      config.LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS,
      DEFAULT_BACKEND_HEALTH_TIMEOUT_MS,
    ),
  };
}
