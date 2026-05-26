import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type { LiveSmokeTargetConfig } from './parse-live-smoke-target-config';
import { liveSmokeTargetSchema, type LiveSmokeTarget } from './live-smoke-target.types';

/**
 * Resolves the live smoke target from scenario fixture defaults and optional env overrides.
 * When LIVE_TEST_ACTUAL_BITRIX_DEAL_ID is set, payload bitrix_deal_id uses the real numeric ID.
 */
export function resolveLiveSmokeTarget(
  context: LiveTestScenarioContext,
  config: LiveSmokeTargetConfig = {},
): LiveSmokeTarget {
  const usesConfiguredDealId = Boolean(config.actualBitrixDealId);

  const target: LiveSmokeTarget = {
    actualBitrixDealId: config.actualBitrixDealId ?? context.bitrixDealId,
    testDealLabel: config.testDealLabel ?? context.testDealTitle,
    expectedScenarioType: context.scenarioType,
    expectedTriggerStageId:
      config.expectedTriggerStageId ?? context.paidStageId,
    manualCrmPreparationConfirmed: usesConfiguredDealId
      ? (config.manualCrmPreparationConfirmed ?? false)
      : false,
  };

  return liveSmokeTargetSchema.parse(target);
}
