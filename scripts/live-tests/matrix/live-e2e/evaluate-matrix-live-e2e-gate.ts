import { isValidTestDealPrefix } from '../../safety-guards';
import { assertDealTitleHasTestPrefix } from '../../bitrix-e2e-setup/build-full-bitrix-deal-fields';
import type { BitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import { resolveBitrixExistingCompanyId } from '../../bitrix-e2e-setup/resolve-bitrix-existing-company-id';
import { resolveBitrixWebhookUrl } from '../../bitrix-e2e-setup/resolve-bitrix-webhook-url';
import type { LiveTestInvoiceType } from '../../types/live-test-report.types';

export interface MatrixLiveE2eGateResult {
  executionAllowed: boolean;
  blockers: string[];
  warnings: string[];
}

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

/**
 * Gate for one matrix live E2E case (sequential orchestrator uses scenarioCount=1 per call).
 * Does not allow bulk flag; each case is a separate guarded invocation.
 */
export function evaluateMatrixLiveE2eGate(
  env: BitrixE2eSetupEnv,
  scenarioType: LiveTestInvoiceType,
  dealTitle: string,
  rawConfig: Record<string, string | undefined> = process.env,
): MatrixLiveE2eGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Matrix live E2E creates one Bitrix test deal and moves it to paid stage.',
    'Set LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER=true to POST /invoice-processes/bitrix-trigger directly (Option B).',
  ];

  const allowMatrixLive =
    rawConfig.LIVE_TEST_ALLOW_MATRIX_LIVE_E2E?.trim() === 'true';
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
    allowMatrixLive,
    blockers,
    'LIVE_TEST_ALLOW_MATRIX_LIVE_E2E must be true',
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
    'ALLOW_BULK_LIVE_TESTS must be false (orchestrator runs one case per guarded invocation)',
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

  if (!['FULL', 'ADVANCE', 'FINAL'].includes(scenarioType)) {
    blockers.push(`Unsupported matrix live scenario type: ${scenarioType}`);
  }

  const webhook = resolveBitrixWebhookUrl(rawConfig);
  requireTrue(
    webhook.configured,
    blockers,
    'LIVE_TEST_BITRIX_WEBHOOK_URL, BITRIX24_WEBHOOK_URL, or LIVE_TEST_BITRIX_BASE_URL + LIVE_TEST_BITRIX_AUTH_SECRET must be configured',
  );

  const existingCompany = resolveBitrixExistingCompanyId(rawConfig);
  requireTrue(
    existingCompany.configured,
    blockers,
    'LIVE_TEST_BITRIX_EXISTING_COMPANY_ID must be configured',
  );

  const paidStageId = env.LIVE_TEST_BITRIX_PAID_STAGE_ID;
  const initialStageId = env.LIVE_TEST_BITRIX_INITIAL_STAGE_ID;
  if (initialStageId && initialStageId === paidStageId) {
    blockers.push(
      'LIVE_TEST_BITRIX_INITIAL_STAGE_ID must differ from paid stage so automation can fire on stage change',
    );
  }

  if (existingCompany.configured) {
    warnings.push(
      'Reusing existing Bitrix test company; enable LIVE_TEST_ALLOW_BITRIX_COMPANY_ADDRESS_ENSURE=true to ensure valid NIP (crm.requisite) and crm.address.list for ADVANCE/FINAL.',
    );
  }

  return {
    executionAllowed: blockers.length === 0,
    blockers,
    warnings,
  };
}
