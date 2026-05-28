import { parseBackendTriggerExecutionConfig } from '../../trigger-execution/backend-trigger-execution-config';
import {
  BackendTriggerFetchTimeoutError,
  fetchBackendBitrixTrigger,
  type BackendTriggerFetchImpl,
} from '../../trigger-execution/fetch-backend-bitrix-trigger';
import { buildMatrixBitrixTriggerPayload } from './build-matrix-bitrix-trigger-payload';
import {
  evaluateMatrixBackendTriggerGate,
  isMatrixBackendTriggerEnabled,
} from './evaluate-matrix-backend-trigger-gate';
import type { BitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import type { MatrixBackendTriggerOutcome } from './matrix-backend-trigger.types';

export interface RunMatrixBackendTriggerInput {
  env: BitrixE2eSetupEnv;
  dealTitle: string;
  bitrixDealId: string;
  paidStageId: string;
  rawConfig?: Record<string, string | undefined>;
  fetchImpl?: BackendTriggerFetchImpl;
}

function parseTriggerResponseBody(bodyText: string): {
  processId?: string;
  triggerStatus?: string;
  message?: string;
} {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    return {
      processId:
        typeof parsed.process_id === 'string' ? parsed.process_id : undefined,
      triggerStatus: typeof parsed.status === 'string' ? parsed.status : undefined,
      message: typeof parsed.message === 'string' ? parsed.message : undefined,
    };
  } catch {
    return {
      message: bodyText.slice(0, 200),
    };
  }
}

function blockedOutcome(
  enabled: boolean,
  blockers: string[],
  warnings: string[],
): MatrixBackendTriggerOutcome {
  return {
    enabled,
    executionAllowed: false,
    requestSent: false,
    resultStatus: 'BLOCKED',
    blockers,
    warnings,
    errors: [],
  };
}

export async function runMatrixBackendTrigger(
  input: RunMatrixBackendTriggerInput,
): Promise<MatrixBackendTriggerOutcome> {
  const rawConfig = input.rawConfig ?? process.env;
  const enabled = isMatrixBackendTriggerEnabled(rawConfig);

  if (!enabled) {
    return blockedOutcome(false, ['LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER must be true'], [
      'Matrix backend trigger skipped.',
    ]);
  }

  const gate = evaluateMatrixBackendTriggerGate(
    input.env,
    input.dealTitle,
    input.bitrixDealId,
    rawConfig,
  );

  if (!gate.executionAllowed) {
    return blockedOutcome(true, gate.blockers, gate.warnings);
  }

  const config = parseBackendTriggerExecutionConfig(rawConfig);
  const payload = buildMatrixBitrixTriggerPayload({
    bitrixDealId: input.bitrixDealId,
    paidStageId: input.paidStageId,
  });

  try {
    const response = await fetchBackendBitrixTrigger({
      config,
      payload,
      fetchImpl: input.fetchImpl,
    });
    const parsedBody = parseTriggerResponseBody(response.bodyText);
    const workflowAccepted = response.statusCode === 202 && response.ok;

    return {
      enabled: true,
      executionAllowed: true,
      requestSent: true,
      httpStatus: response.statusCode,
      triggerStatus: parsedBody.triggerStatus,
      processId: parsedBody.processId,
      message: parsedBody.message,
      resultStatus: workflowAccepted ? 'SENT' : 'FAILED',
      blockers: [],
      warnings: [
        ...gate.warnings,
        'Backend workflow and Fakturownia side effects may have occurred; verify manually.',
      ],
      errors: workflowAccepted
        ? []
        : [`Unexpected HTTP status ${response.statusCode}`],
    };
  } catch (error: unknown) {
    const isTimeout = error instanceof BackendTriggerFetchTimeoutError;
    const message = error instanceof Error ? error.message : String(error);

    return {
      enabled: true,
      executionAllowed: true,
      requestSent: true,
      resultStatus: isTimeout ? 'TIMEOUT' : 'FAILED',
      blockers: [],
      warnings: gate.warnings,
      errors: [message],
    };
  }
}
