import { resolveBackendAuthSecret } from '../resolve-backend-auth-secret';
import { BACKEND_SMOKE_TRIGGER_PATH } from '../smoke-readiness/backend-smoke-readiness.types';
import { BACKEND_TRIGGER_EXECUTION_PATH } from './backend-trigger-execution.types';

export interface BackendTriggerExecutionConfig {
  baseUrl?: string;
  triggerPath?: string;
  authHeaderName?: string;
  authSecret?: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_AUTH_HEADER_NAME = 'x-api-key';

export function parseBackendTriggerExecutionConfig(
  config: Record<string, string | undefined> = process.env,
): BackendTriggerExecutionConfig {
  const baseUrl = config.LIVE_TEST_BACKEND_BASE_URL?.trim();
  const triggerPath =
    config.LIVE_TEST_BACKEND_TRIGGER_PATH?.trim() || BACKEND_SMOKE_TRIGGER_PATH;
  const authHeaderName =
    config.LIVE_TEST_BACKEND_AUTH_HEADER_NAME?.trim() || DEFAULT_AUTH_HEADER_NAME;
  const authSecret = resolveBackendAuthSecret(config);
  const timeoutRaw = config.LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw ? Number.parseInt(timeoutRaw, 10) : DEFAULT_TIMEOUT_MS;

  return {
    baseUrl: baseUrl || undefined,
    triggerPath: triggerPath || undefined,
    authHeaderName: authHeaderName || undefined,
    authSecret: authSecret || undefined,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS,
  };
}

export function assertTriggerExecutionPathAllowed(
  triggerPath: string | undefined,
): void {
  if (triggerPath !== BACKEND_TRIGGER_EXECUTION_PATH) {
    throw new Error(
      `Trigger execution path must be ${BACKEND_TRIGGER_EXECUTION_PATH}`,
    );
  }
}
