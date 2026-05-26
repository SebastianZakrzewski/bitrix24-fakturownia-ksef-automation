import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

/**
 * Loads `.env` for live-test scripts only.
 * Intentionally does not import from `src/` to avoid coupling to Nest bootstrap or app modules.
 */
loadDotenv({ path: resolve(process.cwd(), '.env'), override: true });
