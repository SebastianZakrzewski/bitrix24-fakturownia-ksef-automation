import type { BitrixE2eSetupEnv } from './bitrix-e2e-setup-env';
import {
  buildFullBitrixE2eSetupPayload,
  resolveBitrixE2eDealTitle,
} from './build-full-bitrix-deal-fields';
import { buildBlockedBitrixE2eSetup } from './build-blocked-bitrix-e2e-setup';
import { evaluateBitrixE2eSetupGate } from './evaluate-bitrix-e2e-setup-gate';
import { deriveBitrixAutomationSystemEffects } from './derive-bitrix-automation-system-effects';
import {
  BITRIX_E2E_SETUP_MODE,
  BITRIX_E2E_TRIGGER_MODE,
  type BitrixE2eSetupExecutionResult,
} from './bitrix-e2e-setup.types';
import {
  createBitrixRestCallFn,
  createBitrixTestSetupClient,
  BitrixTestSetupClientError,
} from './bitrix-test-setup-client';
import type { BitrixTestSetupClient } from './bitrix-test-setup-client.types';
import { resolveBitrixWebhookUrl } from './resolve-bitrix-webhook-url';
import { resolveBitrixExistingCompanyId } from './resolve-bitrix-existing-company-id';
import { deriveRealBitrixMutationExecuted } from './derive-real-bitrix-mutation-executed';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';

const DEFAULT_INITIAL_STAGE_ID = 'NEW';

export interface RunBitrixE2eSetupInput {
  env: BitrixE2eSetupEnv;
  scenarioType: LiveTestInvoiceType;
  rawConfig?: Record<string, string | undefined>;
  client?: BitrixTestSetupClient;
}

export async function runBitrixE2eSetup(
  input: RunBitrixE2eSetupInput,
): Promise<BitrixE2eSetupExecutionResult> {
  const rawConfig = input.rawConfig ?? process.env;
  const { env, scenarioType } = input;
  const dealTitle = resolveBitrixE2eDealTitle(rawConfig, env.TEST_DEAL_PREFIX);
  const paidStageId = env.LIVE_TEST_BITRIX_PAID_STAGE_ID;
  const gate = evaluateBitrixE2eSetupGate(env, scenarioType, dealTitle, rawConfig);

  if (!gate.setupAllowed) {
    return buildBlockedBitrixE2eSetup(
      scenarioType,
      dealTitle,
      paidStageId,
      gate.blockers,
      rawConfig,
    );
  }

  const webhook = resolveBitrixWebhookUrl(rawConfig);
  if (!webhook.webhookUrl) {
    return buildBlockedBitrixE2eSetup(
      scenarioType,
      dealTitle,
      paidStageId,
      ['Bitrix webhook URL could not be resolved'],
      rawConfig,
    );
  }

  const initialStageId =
    env.LIVE_TEST_BITRIX_INITIAL_STAGE_ID ?? DEFAULT_INITIAL_STAGE_ID;
  const payload = buildFullBitrixE2eSetupPayload({
    dealTitle,
    initialStageId,
  });

  const client =
    input.client ??
    createBitrixTestSetupClient(createBitrixRestCallFn(webhook.webhookUrl));

  const errors: string[] = [];
  const warnings = [...gate.warnings];
  const existingCompany = resolveBitrixExistingCompanyId(rawConfig);
  const existingCompanyId = existingCompany.companyId!;

  let bitrixMutationStarted = false;
  let bitrixCompanyId: string | undefined;
  let bitrixCompanyReusedExisting = false;
  let bitrixCompanyCreated = false;
  let bitrixDealCreated = false;
  let bitrixDealUpdated = false;
  let bitrixStageChanged = false;
  let bitrixDealId: string | undefined;

  try {
    bitrixMutationStarted = true;
    const { companyId } = await client.useExistingTestCompany(existingCompanyId);
    bitrixCompanyId = companyId;
    bitrixCompanyReusedExisting = true;
    bitrixCompanyCreated = false;
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
  } catch (error: unknown) {
    const message =
      error instanceof BitrixTestSetupClientError
        ? `${error.method}: ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    errors.push(message);

    const automation = deriveBitrixAutomationSystemEffects({ bitrixStageChanged });
    const realBitrixMutationExecuted = deriveRealBitrixMutationExecuted({
      bitrixMutationStarted,
      bitrixDealCreated,
      bitrixDealUpdated,
      bitrixStageChanged,
    });

    return {
      mode: BITRIX_E2E_SETUP_MODE,
      scenarioType,
      triggerMode: BITRIX_E2E_TRIGGER_MODE,
      gate,
      realBitrixMutationExecuted,
      bitrixCompanyId,
      bitrixCompanyReusedExisting,
      bitrixCompanyCreated,
      bitrixDealCreated,
      bitrixDealUpdated,
      bitrixStageChanged,
      bitrixDealId,
      dealTitle,
      dealTitleStartsWithTestPrefix: dealTitle.startsWith('[TEST]'),
      paidStageId,
      runnerDirectBackendTrigger: false,
      backendTriggerRequestSent: false,
      ...automation,
      webhookConfigured: true,
      webhookMasked: webhook.webhookMasked,
      resultStatus: 'BITRIX_E2E_SETUP_FAILED',
      warnings,
      errors,
    };
  }

  const automation = deriveBitrixAutomationSystemEffects({ bitrixStageChanged });
  const realBitrixMutationExecuted = deriveRealBitrixMutationExecuted({
    bitrixMutationStarted,
    bitrixDealCreated,
    bitrixDealUpdated,
    bitrixStageChanged,
  });

  if (bitrixStageChanged) {
    warnings.push(
      'Deal moved to paid stage; Bitrix automation/n8n may have triggered backend workflow and side effects.',
    );
  }

  return {
    mode: BITRIX_E2E_SETUP_MODE,
    scenarioType,
    triggerMode: BITRIX_E2E_TRIGGER_MODE,
    gate,
    realBitrixMutationExecuted,
    bitrixCompanyId,
    bitrixCompanyReusedExisting,
    bitrixCompanyCreated,
    bitrixDealCreated,
    bitrixDealUpdated,
    bitrixStageChanged,
    bitrixDealId,
    dealTitle,
    dealTitleStartsWithTestPrefix: dealTitle.startsWith('[TEST]'),
    paidStageId,
    runnerDirectBackendTrigger: false,
    backendTriggerRequestSent: false,
    ...automation,
    webhookConfigured: true,
    webhookMasked: webhook.webhookMasked,
    resultStatus: 'BITRIX_E2E_SETUP_COMPLETED',
    warnings,
    errors,
  };
}
