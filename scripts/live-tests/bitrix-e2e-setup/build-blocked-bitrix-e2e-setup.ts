import type { BitrixE2eSetupExecutionResult } from './bitrix-e2e-setup.types';
import {
  BITRIX_E2E_SETUP_MODE,
  BITRIX_E2E_TRIGGER_MODE,
} from './bitrix-e2e-setup.types';
import { resolveBitrixWebhookUrl } from './resolve-bitrix-webhook-url';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export function buildBlockedBitrixE2eSetup(
  scenarioType: LiveTestInvoiceType,
  dealTitle: string,
  paidStageId: string,
  blockers: string[],
  rawConfig: Record<string, string | undefined> = process.env,
): BitrixE2eSetupExecutionResult {
  const webhook = resolveBitrixWebhookUrl(rawConfig);

  return {
    mode: BITRIX_E2E_SETUP_MODE,
    scenarioType,
    triggerMode: BITRIX_E2E_TRIGGER_MODE,
    gate: {
      setupAllowed: false,
      dealCreationAllowed: false,
      stageChangeAllowed: false,
      blockers,
      warnings: [],
    },
    realBitrixMutationExecuted: false,
    bitrixDealCreated: false,
    bitrixDealUpdated: false,
    bitrixStageChanged: false,
    dealTitle,
    dealTitleStartsWithTestPrefix: dealTitle.startsWith('[TEST]'),
    paidStageId,
    runnerDirectBackendTrigger: false,
    backendTriggerRequestSent: false,
    bitrixAutomationExpected: true,
    n8nTriggerExpected: true,
    backendWorkflowMayHaveExecuted: false,
    backendSideEffectsMayHaveOccurred: false,
    webhookConfigured: webhook.configured,
    webhookMasked: webhook.webhookMasked,
    resultStatus: 'BITRIX_E2E_SETUP_BLOCKED',
    warnings: [],
    errors: [],
  };
}
