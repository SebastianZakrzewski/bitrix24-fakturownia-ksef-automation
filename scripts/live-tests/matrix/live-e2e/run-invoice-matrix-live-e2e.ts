import type { BitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import { parseBitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import type { BitrixTestSetupClient } from '../../bitrix-e2e-setup/bitrix-test-setup-client.types';
import {
  assertMatrixRunnerPassCaseCounts,
  listMatrixRunnerPassCases,
} from './list-matrix-runner-pass-cases';
import { buildMatrixLiveE2eRunSummary } from './build-matrix-live-e2e-report';
import { resolveMatrixLiveRunSuffix } from './build-matrix-bitrix-deal-payload';
import { isMatrixBackendTriggerEnabled } from './evaluate-matrix-backend-trigger-gate';
import type { MatrixLiveE2eCaseResult } from './matrix-live-e2e.types';
import { runMatrixLiveE2eCase } from './run-matrix-live-e2e-case';

export interface RunInvoiceMatrixLiveE2eInput {
  rawConfig?: Record<string, string | undefined>;
  client?: BitrixTestSetupClient;
  caseIds?: string[];
}

export interface RunInvoiceMatrixLiveE2eOutput {
  env: BitrixE2eSetupEnv;
  summary: ReturnType<typeof buildMatrixLiveE2eRunSummary>;
}

export async function runInvoiceMatrixLiveE2e(
  input: RunInvoiceMatrixLiveE2eInput = {},
): Promise<RunInvoiceMatrixLiveE2eOutput> {
  const rawConfig = input.rawConfig ?? process.env;
  const env = parseBitrixE2eSetupEnv(rawConfig);
  const allPassCases = listMatrixRunnerPassCases();
  assertMatrixRunnerPassCaseCounts(allPassCases);

  const selectedCases =
    input.caseIds && input.caseIds.length > 0
      ? allPassCases.filter((matrixCase) => input.caseIds!.includes(matrixCase.id))
      : allPassCases;

  if (selectedCases.length === 0) {
    throw new Error('No matrix live E2E cases selected');
  }

  const startedAt = new Date();
  const caseResults: MatrixLiveE2eCaseResult[] = [];
  const runSuffix = resolveMatrixLiveRunSuffix(rawConfig, startedAt);
  const delayMs = resolveMatrixLiveE2eDelayMs(rawConfig, selectedCases.length);

  for (let index = 0; index < selectedCases.length; index += 1) {
    const matrixCase = selectedCases[index]!;
    if (index > 0 && delayMs > 0) {
      await sleep(delayMs);
    }

    const result = await runMatrixLiveE2eCase({
      matrixCase,
      env,
      rawConfig,
      client: input.client,
      runSuffix,
    });
    caseResults.push(result);
  }

  const finishedAt = new Date();

  return {
    env,
    summary: buildMatrixLiveE2eRunSummary(caseResults, startedAt, finishedAt, {
      backendTriggerEnabled: isMatrixBackendTriggerEnabled(rawConfig),
    }),
  };
}

function resolveMatrixLiveE2eDelayMs(
  rawConfig: Record<string, string | undefined>,
  caseCount: number,
): number {
  if (caseCount <= 1) {
    return 0;
  }

  const configured = rawConfig.LIVE_TEST_MATRIX_LIVE_E2E_DELAY_MS?.trim();
  if (configured) {
    const parsed = Number.parseInt(configured, 10);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return 3500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
