import { z } from 'zod';
import { parseLiveTestEnv, type LiveTestEnv } from '../live-test-env';

const booleanEnvSchema = z
  .string()
  .optional()
  .transform((value) => value === 'true');

const bitrixE2eExtraSchema = z.object({
  LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION: booleanEnvSchema,
  LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: booleanEnvSchema,
  LIVE_TEST_BITRIX_PAID_STAGE_ID: z.string().min(1).optional(),
  LIVE_TEST_BITRIX_INITIAL_STAGE_ID: z.string().min(1).optional(),
});

export type BitrixE2eSetupEnv = LiveTestEnv & {
  LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION: boolean;
  LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: boolean;
  LIVE_TEST_BITRIX_PAID_STAGE_ID: string;
  LIVE_TEST_BITRIX_INITIAL_STAGE_ID?: string;
};

export function parseBitrixE2eSetupEnv(
  config: Record<string, string | undefined> = process.env,
): BitrixE2eSetupEnv {
  const base = parseLiveTestEnv(config);
  const extra = bitrixE2eExtraSchema.parse({
    LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION:
      config.LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION,
    LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE: config.LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE,
    LIVE_TEST_BITRIX_PAID_STAGE_ID: config.LIVE_TEST_BITRIX_PAID_STAGE_ID,
    LIVE_TEST_BITRIX_INITIAL_STAGE_ID: config.LIVE_TEST_BITRIX_INITIAL_STAGE_ID,
  });

  return {
    ...base,
    ...extra,
    LIVE_TEST_BITRIX_PAID_STAGE_ID:
      extra.LIVE_TEST_BITRIX_PAID_STAGE_ID?.trim() || 'PREPARATION',
    LIVE_TEST_BITRIX_INITIAL_STAGE_ID:
      extra.LIVE_TEST_BITRIX_INITIAL_STAGE_ID?.trim() || undefined,
  };
}
