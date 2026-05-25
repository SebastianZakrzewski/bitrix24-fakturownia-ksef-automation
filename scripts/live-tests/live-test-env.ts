import { z } from 'zod';

const booleanEnvSchema = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const liveTestEnvSchema = z.object({
  LIVE_TEST_MODE: booleanEnvSchema,
  LIVE_TEST_CONFIRM: booleanEnvSchema,
  ENABLE_EXTERNAL_SIDE_EFFECTS: booleanEnvSchema,
  ALLOW_TEST_DEAL_CREATION: booleanEnvSchema,
  TEST_DEAL_PREFIX: z.string().min(1),
  ALLOW_BULK_LIVE_TESTS: booleanEnvSchema,
  ALLOW_DELETE_OR_CANCEL: booleanEnvSchema,
  LIVE_TEST_REPORT_DIR: z.string().min(1).optional(),
});

export type LiveTestEnv = z.infer<typeof liveTestEnvSchema>;

export const DEFAULT_LIVE_TEST_REPORT_DIR = 'reports/live-tests';

export function parseLiveTestEnv(
  config: Record<string, string | undefined> = process.env,
): LiveTestEnv {
  const result = liveTestEnvSchema.safeParse({
    LIVE_TEST_MODE: config.LIVE_TEST_MODE,
    LIVE_TEST_CONFIRM: config.LIVE_TEST_CONFIRM,
    ENABLE_EXTERNAL_SIDE_EFFECTS: config.ENABLE_EXTERNAL_SIDE_EFFECTS,
    ALLOW_TEST_DEAL_CREATION: config.ALLOW_TEST_DEAL_CREATION,
    TEST_DEAL_PREFIX: config.TEST_DEAL_PREFIX,
    ALLOW_BULK_LIVE_TESTS: config.ALLOW_BULK_LIVE_TESTS,
    ALLOW_DELETE_OR_CANCEL: config.ALLOW_DELETE_OR_CANCEL,
    LIVE_TEST_REPORT_DIR: config.LIVE_TEST_REPORT_DIR,
  });

  if (!result.success) {
    throw new Error(
      `Invalid live-test environment: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

export function resolveLiveTestReportDir(env: LiveTestEnv): string {
  return env.LIVE_TEST_REPORT_DIR ?? DEFAULT_LIVE_TEST_REPORT_DIR;
}
