import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

/**
 * Operator flags that may be set in the shell for a single live-test run.
 * These keep priority over `.env` defaults after the file is loaded.
 */
export const OPERATOR_OVERRIDE_ENV_KEYS = [
  'LIVE_TEST_MODE',
  'LIVE_TEST_CONFIRM',
  'ENABLE_EXTERNAL_SIDE_EFFECTS',
  'ALLOW_TEST_DEAL_CREATION',
  'TEST_DEAL_PREFIX',
  'ALLOW_BULK_LIVE_TESTS',
  'ALLOW_DELETE_OR_CANCEL',
  'LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION',
  'LIVE_TEST_REPORT_DIR',
  'LIVE_TEST_ACTUAL_BITRIX_DEAL_ID',
  'LIVE_TEST_DEAL_LABEL',
  'LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED',
  'LIVE_TEST_EXPECTED_TRIGGER_STAGE_ID',
  'LIVE_TEST_BACKEND_BASE_URL',
  'LIVE_TEST_BACKEND_TRIGGER_PATH',
  'LIVE_TEST_BACKEND_AUTH_HEADER_NAME',
  'LIVE_TEST_BACKEND_AUTH_SECRET',
  'LIVE_TEST_BACKEND_HEALTH_PATH',
  'LIVE_TEST_BACKEND_REQUEST_TIMEOUT_MS',
  'LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION',
  'LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE',
  'LIVE_TEST_ALLOW_BITRIX_COMPANY_ADDRESS_ENSURE',
  'LIVE_TEST_BITRIX_PAID_STAGE_ID',
  'LIVE_TEST_BITRIX_INITIAL_STAGE_ID',
  'LIVE_TEST_BITRIX_WEBHOOK_URL',
  'LIVE_TEST_BITRIX_BASE_URL',
  'LIVE_TEST_BITRIX_AUTH_SECRET',
  'LIVE_TEST_BITRIX_EXISTING_COMPANY_ID',
  'LIVE_TEST_ALLOW_MATRIX_LIVE_E2E',
  'LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER',
  'LIVE_TEST_DEAL_LABEL',
] as const;

/**
 * Loads `.env` for live-test scripts only.
 * Intentionally does not import from `src/` to avoid coupling to Nest bootstrap or app modules.
 *
 * Uses `override: true` so on-disk `.env` wins over dotenvx/preload injection (e.g. N8N_API_KEY),
 * then restores explicit operator flags that were already set in the process environment.
 */
export function loadLiveTestDotenv(envPath?: string): void {
  const preserved: Record<string, string | undefined> = {};
  for (const key of OPERATOR_OVERRIDE_ENV_KEYS) {
    preserved[key] = process.env[key];
  }

  loadDotenv({
    path: envPath ?? resolve(process.cwd(), '.env'),
    override: true,
  });

  for (const key of OPERATOR_OVERRIDE_ENV_KEYS) {
    if (preserved[key] !== undefined) {
      process.env[key] = preserved[key];
    }
  }
}

loadLiveTestDotenv();
