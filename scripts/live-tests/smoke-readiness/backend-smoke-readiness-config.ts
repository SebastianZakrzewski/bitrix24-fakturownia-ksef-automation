import { resolveBackendAuthSecret } from '../resolve-backend-auth-secret';
import { BACKEND_SMOKE_TRIGGER_PATH } from './backend-smoke-readiness.types';

export interface BackendSmokeReadinessConfig {
  baseUrl?: string;
  triggerPath?: string;
  authHeaderName?: string;
  authSecret?: string;
}

export function parseBackendSmokeReadinessConfig(
  config: Record<string, string | undefined> = process.env,
): BackendSmokeReadinessConfig {
  const baseUrl = config.LIVE_TEST_BACKEND_BASE_URL?.trim();
  const triggerPath =
    config.LIVE_TEST_BACKEND_TRIGGER_PATH?.trim() || BACKEND_SMOKE_TRIGGER_PATH;
  const authHeaderName = config.LIVE_TEST_BACKEND_AUTH_HEADER_NAME?.trim();
  const authSecret = resolveBackendAuthSecret(config);

  return {
    baseUrl: baseUrl || undefined,
    triggerPath: triggerPath || undefined,
    authHeaderName: authHeaderName || undefined,
    authSecret: authSecret || undefined,
  };
}
