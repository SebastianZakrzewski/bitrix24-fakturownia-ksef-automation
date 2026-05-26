export interface LiveSmokeTargetConfig {
  actualBitrixDealId?: string;
  testDealLabel?: string;
  expectedTriggerStageId?: string;
  manualCrmPreparationConfirmed?: boolean;
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }

  return value.trim().toLowerCase() === 'true';
}

export function parseLiveSmokeTargetConfig(
  config: Record<string, string | undefined> = process.env,
): LiveSmokeTargetConfig {
  const actualBitrixDealId = config.LIVE_TEST_ACTUAL_BITRIX_DEAL_ID?.trim();
  const testDealLabel = config.LIVE_TEST_DEAL_LABEL?.trim();
  const expectedTriggerStageId = config.LIVE_TEST_EXPECTED_TRIGGER_STAGE_ID?.trim();
  const manualCrmPreparationConfirmed = parseBooleanEnv(
    config.LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED,
  );

  return {
    actualBitrixDealId: actualBitrixDealId || undefined,
    testDealLabel: testDealLabel || undefined,
    expectedTriggerStageId: expectedTriggerStageId || undefined,
    manualCrmPreparationConfirmed,
  };
}
