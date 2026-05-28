import { deriveBitrixAutomationSystemEffects } from '../../bitrix-e2e-setup/derive-bitrix-automation-system-effects';
import { deriveRealBitrixMutationExecuted } from '../../bitrix-e2e-setup/derive-real-bitrix-mutation-executed';
import type { BitrixE2eSetupEnv } from '../../bitrix-e2e-setup/bitrix-e2e-setup-env';
import {
  BitrixTestSetupClientError,
  createBitrixRestCallFn,
  createBitrixTestSetupClient,
} from '../../bitrix-e2e-setup/bitrix-test-setup-client';
import type { BitrixTestSetupClient } from '../../bitrix-e2e-setup/bitrix-test-setup-client.types';
import { resolveBitrixExistingCompanyId } from '../../bitrix-e2e-setup/resolve-bitrix-existing-company-id';
import { resolveBitrixWebhookUrl } from '../../bitrix-e2e-setup/resolve-bitrix-webhook-url';
import type { FinalLiveTestScenarioContext } from '../../fixtures/scenario-context.types';
import type { InvoiceRunnerMatrixCase } from '../invoice-runner-matrix.types';
import {
  buildMatrixBitrixDealPayload,
  resolveMatrixLiveDealTitle,
} from './build-matrix-bitrix-deal-payload';
import { buildMatrixFinalAdvanceSeedContext } from './build-matrix-final-advance-seed-context';
import { evaluateMatrixLiveE2eGate } from './evaluate-matrix-live-e2e-gate';
import { isMatrixBackendTriggerEnabled } from './evaluate-matrix-backend-trigger-gate';
import {
  isMatrixCompanyBuyerEnsureEnabled,
  resolveMatrixTestCompanyBuyer,
} from './resolve-matrix-test-company-address';
import type { MatrixBackendTriggerOutcome } from './matrix-backend-trigger.types';
import {
  BACKEND_TRIGGER_FAILURE_STATUSES,
  isMatrixBackendTriggerWorkflowSuccess,
} from './matrix-backend-trigger.types';
import type { MatrixLiveE2eCaseResult } from './matrix-live-e2e.types';
import { runMatrixBackendTrigger } from './run-matrix-backend-trigger';
import type { BackendTriggerFetchImpl } from '../../trigger-execution/fetch-backend-bitrix-trigger';

const DEFAULT_INITIAL_STAGE_ID = 'NEW';

export interface RunMatrixLiveE2eCaseInput {
  matrixCase: InvoiceRunnerMatrixCase;
  env: BitrixE2eSetupEnv;
  rawConfig?: Record<string, string | undefined>;
  client?: BitrixTestSetupClient;
  fetchImpl?: BackendTriggerFetchImpl;
  runSuffix?: string;
}

export async function runMatrixLiveE2eCase(
  input: RunMatrixLiveE2eCaseInput,
): Promise<MatrixLiveE2eCaseResult> {
  const startedAt = new Date();
  const rawConfig = input.rawConfig ?? process.env;
  const { matrixCase, env } = input;
  const context = matrixCase.prepare().context;

  if (!context) {
    return blockedCaseResult(matrixCase, startedAt, ['Matrix case missing context']);
  }

  const dealTitle = resolveMatrixLiveDealTitle(
    matrixCase.id,
    context,
    input.runSuffix,
  );
  const paidStageId = env.LIVE_TEST_BITRIX_PAID_STAGE_ID;
  const gate = evaluateMatrixLiveE2eGate(env, matrixCase.invoiceType, dealTitle, rawConfig);

  if (!gate.executionAllowed) {
    return blockedCaseResult(matrixCase, startedAt, gate.blockers, gate.warnings, dealTitle, paidStageId);
  }

  const webhook = resolveBitrixWebhookUrl(rawConfig);
  if (!webhook.webhookUrl) {
    return blockedCaseResult(
      matrixCase,
      startedAt,
      ['Bitrix webhook URL could not be resolved'],
      gate.warnings,
      dealTitle,
      paidStageId,
    );
  }

  const initialStageId =
    env.LIVE_TEST_BITRIX_INITIAL_STAGE_ID ?? DEFAULT_INITIAL_STAGE_ID;
  const backendTriggerEnabled = isMatrixBackendTriggerEnabled(rawConfig);
  const useFinalAdvanceSeed =
    backendTriggerEnabled && matrixCase.invoiceType === 'FINAL';

  const payload = useFinalAdvanceSeed
    ? buildMatrixBitrixDealPayload(
        buildMatrixFinalAdvanceSeedContext(
          context as FinalLiveTestScenarioContext,
          dealTitle,
        ),
        initialStageId,
      )
    : buildMatrixBitrixDealPayload({ ...context, testDealTitle: dealTitle }, initialStageId);

  const client =
    input.client ??
    createBitrixTestSetupClient(createBitrixRestCallFn(webhook.webhookUrl));

  const existingCompanyId = resolveBitrixExistingCompanyId(rawConfig).companyId!;
  const warnings = [...gate.warnings];
  const errors: string[] = [];

  let bitrixMutationStarted = false;
  let bitrixCompanyId: string | undefined;
  let bitrixDealCreated = false;
  let bitrixDealUpdated = false;
  let bitrixStageChanged = false;
  let bitrixDealId: string | undefined;
  let advanceSeedBackendTrigger: MatrixBackendTriggerOutcome | undefined;
  let backendTrigger: MatrixBackendTriggerOutcome | undefined;

  try {
    bitrixMutationStarted = true;
    const { companyId } = await client.useExistingTestCompany(existingCompanyId);
    bitrixCompanyId = companyId;

    if (isMatrixCompanyBuyerEnsureEnabled(rawConfig)) {
      const buyer = resolveMatrixTestCompanyBuyer(context.buyer, rawConfig);

      const requisiteEnsure = await client.ensureExistingTestCompanyRequisite(
        companyId,
        buyer.nip,
      );
      if (requisiteEnsure.nipUpdated) {
        warnings.push(
          `Updated company ${companyId} requisite NIP for Fakturownia ADVANCE/FINAL compatibility.`,
        );
      }

      const addressEnsure = await client.ensureExistingTestCompanyAddress(
        companyId,
        buyer,
      );
      if (addressEnsure.addressAdded) {
        warnings.push(
          `Added missing crm.address.list entry for company ${companyId}.`,
        );
      }
    }

    const { dealId } = await client.createTestDeal({
      ...payload.deal,
      companyId,
    });
    bitrixDealCreated = true;
    bitrixDealId = dealId;

    await client.updateTestDeal(dealId, payload.deal.customFields);
    bitrixDealUpdated = true;

    await client.setDealStage(dealId, paidStageId);
    bitrixStageChanged = true;

    if (useFinalAdvanceSeed) {
      advanceSeedBackendTrigger = await runMatrixBackendTrigger({
        env,
        dealTitle,
        bitrixDealId: dealId,
        paidStageId,
        rawConfig,
        fetchImpl: input.fetchImpl,
      });

      const advanceSeedErrors = collectBackendTriggerErrors(
        advanceSeedBackendTrigger,
        'ADVANCE seed',
      );
      errors.push(...advanceSeedErrors);

      if (advanceSeedErrors.length > 0) {
        return finishCaseResult(matrixCase, startedAt, {
          status: 'MATRIX_LIVE_E2E_FAILED',
          dealTitle,
          paidStageId,
          bitrixCompanyId,
          bitrixDealId,
          bitrixDealCreated,
          bitrixDealUpdated,
          bitrixStageChanged,
          bitrixMutationStarted,
          backendTriggerEnabled,
          advanceSeedBackendTrigger,
          backendTrigger,
          warnings,
          errors,
        });
      }

      await client.setDealStage(dealId, initialStageId);

      const finalPayload = buildMatrixBitrixDealPayload(
        { ...context, testDealTitle: dealTitle },
        initialStageId,
      );
      await client.updateTestDeal(dealId, finalPayload.deal.customFields);
      await client.setDealStage(dealId, paidStageId);
    }
  } catch (error: unknown) {
    const message =
      error instanceof BitrixTestSetupClientError
        ? `${error.method}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    errors.push(message);

    return finishCaseResult(matrixCase, startedAt, {
      status: 'MATRIX_LIVE_E2E_FAILED',
      dealTitle,
      paidStageId,
      bitrixCompanyId,
      bitrixDealId,
      bitrixDealCreated,
      bitrixDealUpdated,
      bitrixStageChanged,
      bitrixMutationStarted,
      backendTriggerEnabled,
      advanceSeedBackendTrigger,
      backendTrigger,
      warnings,
      errors,
    });
  }

  if (backendTriggerEnabled && bitrixDealId) {
    backendTrigger = await runMatrixBackendTrigger({
      env,
      dealTitle,
      bitrixDealId,
      paidStageId,
      rawConfig,
      fetchImpl: input.fetchImpl,
    });

    errors.push(...collectBackendTriggerErrors(backendTrigger, matrixCase.invoiceType));
  } else if (bitrixStageChanged) {
    warnings.push(
      'Deal moved to paid stage; enable LIVE_TEST_ALLOW_MATRIX_BACKEND_TRIGGER to POST bitrix-trigger directly.',
    );
  }

  const status =
    errors.length > 0 ? 'MATRIX_LIVE_E2E_FAILED' : 'MATRIX_LIVE_E2E_COMPLETED';

  return finishCaseResult(matrixCase, startedAt, {
    status,
    dealTitle,
    paidStageId,
    bitrixCompanyId,
    bitrixDealId,
    bitrixDealCreated,
    bitrixDealUpdated,
    bitrixStageChanged,
    bitrixMutationStarted,
    backendTriggerEnabled,
    advanceSeedBackendTrigger,
    backendTrigger,
    warnings,
    errors,
  });
}

function collectBackendTriggerErrors(
  outcome: MatrixBackendTriggerOutcome,
  label: string,
): string[] {
  if (!outcome.enabled || !outcome.executionAllowed) {
    return outcome.blockers.map((blocker) => `${label}: ${blocker}`);
  }

  if (outcome.resultStatus === 'TIMEOUT') {
    return [`${label}: backend trigger request timed out`];
  }

  if (outcome.resultStatus === 'FAILED') {
    return [
      `${label}: backend trigger failed (${outcome.errors.join('; ') || 'unknown error'})`,
    ];
  }

  if (isDuplicateMatrixBackendTriggerResponse(outcome)) {
    const status = outcome.triggerStatus;
    if (
      status &&
      !BACKEND_TRIGGER_FAILURE_STATUSES.has(status) &&
      status !== 'FAKTUROWNIA_ERROR'
    ) {
      return [];
    }
  }

  if (
    !isMatrixBackendTriggerWorkflowSuccess({
      httpStatus: outcome.httpStatus,
      triggerStatus: outcome.triggerStatus,
    })
  ) {
    return [
      `${label}: backend returned status ${outcome.triggerStatus ?? 'unknown'} (${outcome.message ?? 'no message'})`,
    ];
  }

  return [];
}

function isDuplicateMatrixBackendTriggerResponse(
  outcome: MatrixBackendTriggerOutcome,
): boolean {
  return (
    outcome.httpStatus === 202 &&
    Boolean(outcome.message?.includes('Invoice process already exists with status'))
  );
}

function blockedCaseResult(
  matrixCase: InvoiceRunnerMatrixCase,
  startedAt: Date,
  blockers: string[],
  warnings: string[] = [],
  dealTitle = '',
  paidStageId = 'PREPARATION',
): MatrixLiveE2eCaseResult {
  const finishedAt = new Date();

  return {
    caseId: matrixCase.id,
    invoiceType: matrixCase.invoiceType,
    description: matrixCase.description,
    matrixCaseId: matrixCase.id,
    status: 'MATRIX_LIVE_E2E_BLOCKED',
    dealTitle,
    paidStageId,
    realBitrixMutationExecuted: false,
    bitrixDealCreated: false,
    bitrixDealUpdated: false,
    bitrixStageChanged: false,
    runnerDirectBackendTrigger: false,
    backendTriggerRequestSent: false,
    bitrixAutomationExpected: false,
    backendWorkflowMayHaveExecuted: false,
    backendSideEffectsMayHaveOccurred: false,
    gateBlockers: blockers,
    warnings,
    errors: [],
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

function finishCaseResult(
  matrixCase: InvoiceRunnerMatrixCase,
  startedAt: Date,
  input: {
    status: 'MATRIX_LIVE_E2E_COMPLETED' | 'MATRIX_LIVE_E2E_FAILED';
    dealTitle: string;
    paidStageId: string;
    bitrixCompanyId?: string;
    bitrixDealId?: string;
    bitrixDealCreated: boolean;
    bitrixDealUpdated: boolean;
    bitrixStageChanged: boolean;
    bitrixMutationStarted: boolean;
    backendTriggerEnabled: boolean;
    advanceSeedBackendTrigger?: MatrixBackendTriggerOutcome;
    backendTrigger?: MatrixBackendTriggerOutcome;
    warnings: string[];
    errors: string[];
  },
): MatrixLiveE2eCaseResult {
  const finishedAt = new Date();
  const automation = deriveBitrixAutomationSystemEffects({
    bitrixStageChanged: input.bitrixStageChanged,
  });
  const realBitrixMutationExecuted = deriveRealBitrixMutationExecuted({
    bitrixMutationStarted: input.bitrixMutationStarted,
    bitrixDealCreated: input.bitrixDealCreated,
    bitrixDealUpdated: input.bitrixDealUpdated,
    bitrixStageChanged: input.bitrixStageChanged,
  });

  const backendTriggerRequestSent = Boolean(
    input.backendTrigger?.requestSent ||
      input.advanceSeedBackendTrigger?.requestSent,
  );
  const runnerDirectBackendTrigger =
    input.backendTriggerEnabled && backendTriggerRequestSent;
  const backendWorkflowMayHaveExecuted =
    runnerDirectBackendTrigger ||
    (input.backendTriggerEnabled ? false : automation.backendWorkflowMayHaveExecuted);
  const backendSideEffectsMayHaveOccurred =
    runnerDirectBackendTrigger ||
    (input.backendTriggerEnabled ? false : automation.backendSideEffectsMayHaveOccurred);

  return {
    caseId: matrixCase.id,
    invoiceType: matrixCase.invoiceType,
    description: matrixCase.description,
    matrixCaseId: matrixCase.id,
    status: input.status,
    dealTitle: input.dealTitle,
    bitrixDealId: input.bitrixDealId,
    bitrixCompanyId: input.bitrixCompanyId,
    paidStageId: input.paidStageId,
    realBitrixMutationExecuted,
    bitrixDealCreated: input.bitrixDealCreated,
    bitrixDealUpdated: input.bitrixDealUpdated,
    bitrixStageChanged: input.bitrixStageChanged,
    runnerDirectBackendTrigger,
    backendTriggerRequestSent,
    backendTrigger: input.backendTrigger,
    advanceSeedBackendTrigger: input.advanceSeedBackendTrigger,
    bitrixAutomationExpected: input.backendTriggerEnabled
      ? false
      : automation.bitrixAutomationExpected,
    backendWorkflowMayHaveExecuted,
    backendSideEffectsMayHaveOccurred,
    gateBlockers: [],
    warnings: input.warnings,
    errors: input.errors,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}
