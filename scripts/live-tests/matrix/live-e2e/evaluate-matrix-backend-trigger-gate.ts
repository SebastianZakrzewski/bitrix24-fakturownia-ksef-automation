import { assertDealTitleHasTestPrefix } from '../../bitrix-e2e-setup/build-full-bitrix-deal-fields';
import type { BitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import { isValidTestDealPrefix } from '../../safety-guards';
import { parseBackendTriggerExecutionConfig } from '../../trigger-execution/backend-trigger-execution-config';
import { BACKEND_TRIGGER_EXECUTION_PATH } from '../../trigger-execution/backend-trigger-execution.types';

export interface MatrixBackendTriggerGateResult {
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

export function isMatrixBackendTriggerEnabled(
  rawConfig: Record<string, string | undefined> = process.env,
): boolean {
  return rawConfig.LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER?.trim() === 'true';
}

/**
 * Gate for controlled POST /invoice-processes/bitrix-trigger after matrix Bitrix setup.
 * Separate from smoke trigger gate: allows ALLOW_TEST_DEAL_CREATION and real deal IDs per case.
 */
export function evaluateMatrixBackendTriggerGate(
  env: BitrixE2eSetupEnv,
  dealTitle: string,
  bitrixDealId: string | undefined,
  rawConfig: Record<string, string | undefined> = process.env,
): MatrixBackendTriggerGateResult {
  const blockers: string[] = [];
  const warnings: string[] = [
    'Matrix backend trigger sends POST /invoice-processes/bitrix-trigger per completed Bitrix case.',
    'FINAL cases run ADVANCE seed trigger on the same deal before FINAL trigger.',
  ];

  if (!isMatrixBackendTriggerEnabled(rawConfig)) {
    return {
      executionAllowed: false,
      blockers: ['LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER must be true'],
      warnings: [
        'Matrix backend trigger is disabled; only Bitrix deal setup runs.',
      ],
    };
  }

  const allowMatrixLive =
    rawConfig.LIVE_TEST_ALLOW_MATRIX_LIVE_E2E?.trim() === 'true';

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

  if (!bitrixDealId?.trim()) {
    blockers.push('bitrixDealId is required for matrix backend trigger');
  }

  const backendConfig = parseBackendTriggerExecutionConfig(rawConfig);
  if (!backendConfig.baseUrl) {
    blockers.push('LIVE_TEST_BACKEND_BASE_URL is not configured');
  }

  if (!backendConfig.authHeaderName) {
    blockers.push('LIVE_TEST_BACKEND_AUTH_HEADER_NAME is not configured');
  }

  if (!backendConfig.authSecret) {
    blockers.push(
      'LIVE_TEST_BACKEND_AUTH_SECRET or N8N_API_KEY must be configured for backend trigger auth',
    );
  }

  if (backendConfig.triggerPath !== BACKEND_TRIGGER_EXECUTION_PATH) {
    blockers.push(
      `LIVE_TEST_BACKEND_TRIGGER_PATH must be ${BACKEND_TRIGGER_EXECUTION_PATH}`,
    );
  }

  return {
    executionAllowed: blockers.length === 0,
    blockers,
    warnings,
  };
}
