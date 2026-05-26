export const ISOLATED_LIVE_TEST_ENV_KEYS = [
  'LIVE_TEST_BACKEND_BASE_URL',
  'LIVE_TEST_BACKEND_TRIGGER_PATH',
  'LIVE_TEST_BACKEND_AUTH_HEADER_NAME',
  'LIVE_TEST_BACKEND_AUTH_SECRET',
  'LIVE_TEST_BACKEND_HEALTH_PATH',
  'LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS',
  'LIVE_TEST_ACTUAL_BITRIX_DEAL_ID',
  'LIVE_TEST_DEAL_LABEL',
  'LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED',
  'LIVE_TEST_EXPECTED_TRIGGER_STAGE_ID',
  'LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION',
] as const;

export function saveAndClearLiveTestEnvKeys(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};

  for (const key of ISOLATED_LIVE_TEST_ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }

  return saved;
}

export function restoreLiveTestEnvKeys(
  saved: Record<string, string | undefined>,
): void {
  for (const key of ISOLATED_LIVE_TEST_ENV_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
}
