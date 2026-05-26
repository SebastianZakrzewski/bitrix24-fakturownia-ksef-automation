import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

/**
 * Loads `.env` for live-test scripts only.
 * Intentionally does not import from `src/` to avoid coupling to Nest bootstrap or app modules.
 *
 * Uses `override: false` so explicit CLI/process env flags keep priority over `.env`.
 */
export function loadLiveTestDotenv(envPath?: string): void {
  loadDotenv({
    path: envPath ?? resolve(process.cwd(), '.env'),
    override: false,
  });
}

loadLiveTestDotenv();
