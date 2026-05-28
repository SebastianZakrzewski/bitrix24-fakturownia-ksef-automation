import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export const BITRIX_E2E_SETUP_MODE = 'CONTROLLED_BITRIX_E2E_SETUP' as const;
export const BITRIX_E2E_TRIGGER_MODE = 'BITRIX_AUTOMATION_N8N_EXPECTED' as const;

export type BitrixE2eSetupMode = typeof BITRIX_E2E_SETUP_MODE;
export type BitrixE2eTriggerMode = typeof BITRIX_E2E_TRIGGER_MODE;

export type BitrixE2eSetupResultStatus =
  | 'BITRIX_E2E_SETUP_BLOCKED'
  | 'BITRIX_E2E_SETUP_COMPLETED'
  | 'BITRIX_E2E_SETUP_FAILED';

export interface BitrixE2eSetupGateResult {
  setupAllowed: boolean;
  dealCreationAllowed: boolean;
  stageChangeAllowed: boolean;
  blockers: string[];
  warnings: string[];
}

export interface BitrixE2eSetupExecutionResult {
  mode: BitrixE2eSetupMode;
  scenarioType: LiveTestInvoiceType;
  triggerMode: BitrixE2eTriggerMode;
  gate: BitrixE2eSetupGateResult;
  realBitrixMutationExecuted: boolean;
  bitrixCompanyId?: string;
  bitrixCompanyReusedExisting: boolean;
  bitrixCompanyCreated: boolean;
  bitrixDealCreated: boolean;
  bitrixDealUpdated: boolean;
  bitrixStageChanged: boolean;
  bitrixDealId?: string;
  dealTitle: string;
  dealTitleStartsWithTestPrefix: boolean;
  paidStageId: string;
  runnerDirectBackendTrigger: false;
  backendTriggerRequestSent: false;
  bitrixAutomationExpected: boolean;
  n8nTriggerExpected: boolean;
  backendWorkflowMayHaveExecuted: boolean;
  backendSideEffectsMayHaveOccurred: boolean;
  webhookConfigured: boolean;
  webhookMasked?: string;
  resultStatus: BitrixE2eSetupResultStatus;
  warnings: string[];
  errors: string[];
}
