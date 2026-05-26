import { isValidTestDealPrefix } from '../safety-guards';
import type { BitrixE2eSetupEnv } from './bitrix-e2e-setup-env';
import { assertDealTitleHasTestPrefix } from './build-full-bitrix-deal-fields';
import type { BitrixE2eSetupGateResult } from './bitrix-e2e-setup.types';
import { resolveBitrixWebhookUrl } from './resolve-bitrix-webhook-url';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';

function requireTrue(
  condition: boolean,
  blockers: string[],
  message: string,
): void {
  if (!condition) {
    blockers.push(message);
  }
}

function requireFalse(
  condition: boolean,
  blockers: string[],
  message: string,
): void {
  if (condition) {
    blockers.push(message);
  }
}

export function evaluateBitrixE2eSetupGate(
  env: BitrixE2eSetupEnv,
  scenarioType: LiveTestInvoiceType,
  dealTitle: string,
  rawConfig: Record<string, string | undefined> = process.env,
): BitrixE2eSetupGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Bitrix E2E setup does not call POST /invoice-processes/bitrix-trigger; Bitrix/n8n automation is expected to trigger the backend after stage change.',
  ];

  const allowDealCreation =
    rawConfig.LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION?.trim() === 'true';
  const allowStageChange =
    rawConfig.LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE?.trim() === 'true';

  requireTrue(env.LIVE_TEST_MODE, blockers, 'LIVE_TEST_MODE must be true');
  requireTrue(env.LIVE_TEST_CONFIRM, blockers, 'LIVE_TEST_CONFIRM must be true');
  requireTrue(
    env.ENABLE_EXTERNAL_SIDE_EFFECTS,
    blockers,
    'ENABLE_EXTERNAL_SIDE_EFFECTS must be true',
  );
  requireTrue(
    allowDealCreation,
    blockers,
    'LIVE_TEST_ALLOW_BITRIX_TEST_DEAL_CREATION must be true',
  );
  requireTrue(
    allowStageChange,
    blockers,
    'LIVE_TEST_ALLOW_BITRIX_STAGE_CHANGE must be true',
  );
  requireTrue(
    env.ALLOW_TEST_DEAL_CREATION,
    blockers,
    'ALLOW_TEST_DEAL_CREATION must be true',
  );
  requireFalse(
    env.ALLOW_BULK_LIVE_TESTS,
    blockers,
    'ALLOW_BULK_LIVE_TESTS must be false',
  );
  requireFalse(
    env.ALLOW_DELETE_OR_CANCEL,
    blockers,
    'ALLOW_DELETE_OR_CANCEL must be false',
  );
  requireTrue(
    isValidTestDealPrefix(env.TEST_DEAL_PREFIX),
    blockers,
    'TEST_DEAL_PREFIX must be [TEST] or start with [TEST]',
  );
  requireTrue(
    assertDealTitleHasTestPrefix(dealTitle),
    blockers,
    'Deal title must start with [TEST]',
  );

  if (scenarioType !== 'FULL') {
    blockers.push(`Bitrix E2E setup is only supported for FULL (blocked: ${scenarioType})`);
  }

  const webhook = resolveBitrixWebhookUrl(rawConfig);
  requireTrue(
    webhook.configured,
    blockers,
    'LIVE_TEST_BITRIX_WEBHOOK_URL, BITRIX24_WEBHOOK_URL, or LIVE_TEST_BITRIX_BASE_URL + LIVE_TEST_BITRIX_AUTH_SECRET must be configured',
  );

  const paidStageId = env.LIVE_TEST_BITRIX_PAID_STAGE_ID;
  const initialStageId = env.LIVE_TEST_BITRIX_INITIAL_STAGE_ID;
  if (initialStageId && initialStageId === paidStageId) {
    blockers.push(
      'LIVE_TEST_BITRIX_INITIAL_STAGE_ID must differ from paid stage so automation can fire on stage change',
    );
  }

  if (!initialStageId) {
    warnings.push(
      'LIVE_TEST_BITRIX_INITIAL_STAGE_ID is not set; default initial stage NEW is used (verify on Evapremium portal).',
    );
  }

  const setupAllowed = blockers.length === 0;

  return {
    setupAllowed,
    dealCreationAllowed: setupAllowed && allowDealCreation,
    stageChangeAllowed: setupAllowed && allowStageChange,
    blockers,
    warnings,
  };
}
