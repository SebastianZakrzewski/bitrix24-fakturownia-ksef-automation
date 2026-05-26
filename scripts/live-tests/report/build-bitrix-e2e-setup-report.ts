import type { BitrixE2eSetupExecutionResult } from '../bitrix-e2e-setup/bitrix-e2e-setup.types';
import { BITRIX_E2E_SETUP_MODE, BITRIX_E2E_TRIGGER_MODE } from '../bitrix-e2e-setup/bitrix-e2e-setup.types';
import type { SafetyCheck } from '../types/live-test-report.types';
import {
  LIVE_TEST_RUNNER_VERSION_BITRIX_E2E,
  type BitrixE2eSetupReport,
} from '../types/bitrix-e2e-setup-report.types';

export interface BuildBitrixE2eSetupReportInput {
  execution: BitrixE2eSetupExecutionResult;
  safetyChecks: SafetyCheck[];
  startedAt: Date;
  finishedAt: Date;
}

function runnerDirectSideEffects(
  execution: BitrixE2eSetupExecutionResult,
): BitrixE2eSetupReport['runnerDirectSideEffects'] {
  const bitrixCalled =
    execution.bitrixDealCreated ||
    execution.bitrixDealUpdated ||
    execution.bitrixStageChanged;

  return {
    runnerDirectBitrixCall: bitrixCalled,
    runnerDirectFakturowniaCall: false,
    runnerDirectDbWrite: false,
    runnerDirectKsefCall: false,
    runnerDirectBackendTrigger: false,
    runnerDirectExternalSideEffectsExecuted: bitrixCalled,
  };
}

export function buildBitrixE2eSetupReport(
  input: BuildBitrixE2eSetupReportInput,
): BitrixE2eSetupReport {
  const { execution, safetyChecks, startedAt, finishedAt } = input;
  const runnerDirect = runnerDirectSideEffects(execution);

  const summary =
    execution.resultStatus === 'BITRIX_E2E_SETUP_COMPLETED'
      ? `Bitrix E2E FULL setup completed; deal ${execution.bitrixDealId ?? 'unknown'} moved to ${execution.paidStageId}. Verify backend/n8n workflow manually.`
      : execution.resultStatus === 'BITRIX_E2E_SETUP_FAILED'
        ? `Bitrix E2E FULL setup failed: ${execution.errors.join('; ') || 'unknown error'}`
        : `Bitrix E2E FULL setup blocked: ${execution.gate.blockers.join('; ') || 'gate closed'}`;

  return {
    mode: BITRIX_E2E_SETUP_MODE,
    triggerMode: BITRIX_E2E_TRIGGER_MODE,
    meta: {
      scenarioId: 'full',
      invoiceType: 'FULL',
      runnerVersion: LIVE_TEST_RUNNER_VERSION_BITRIX_E2E,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    },
    safety: {
      passed: safetyChecks.every((check) => check.status !== 'failed'),
      checks: safetyChecks,
    },
    productionReadiness: 'NOT_READY',
    scenarioType: 'FULL',
    expectedInvoiceType: 'FULL',
    bitrixDealCreated: execution.bitrixDealCreated,
    bitrixDealUpdated: execution.bitrixDealUpdated,
    bitrixStageChanged: execution.bitrixStageChanged,
    bitrixDealId: execution.bitrixDealId,
    dealTitle: execution.dealTitle,
    dealTitleStartsWithTestPrefix: execution.dealTitleStartsWithTestPrefix,
    paidStageId: execution.paidStageId,
    runnerDirectBackendTrigger: false,
    backendTriggerRequestSent: false,
    bitrixAutomationExpected: true,
    n8nTriggerExpected: true,
    backendWorkflowMayHaveExecuted: execution.backendWorkflowMayHaveExecuted,
    backendSideEffectsMayHaveOccurred: execution.backendSideEffectsMayHaveOccurred,
    manualVerificationRequired: true,
    deleteOrCancelExecuted: false,
    bulkExecution: false,
    runnerDirectSideEffects: runnerDirect,
    runnerDirectExternalSideEffectsExecuted:
      runnerDirect.runnerDirectExternalSideEffectsExecuted,
    bitrixE2eSetup: {
      mode: execution.mode,
      triggerMode: execution.triggerMode,
      scenarioType: 'FULL',
      expectedInvoiceType: 'FULL',
      gate: execution.gate,
      bitrixDealCreated: execution.bitrixDealCreated,
      bitrixDealUpdated: execution.bitrixDealUpdated,
      bitrixStageChanged: execution.bitrixStageChanged,
      bitrixDealId: execution.bitrixDealId,
      dealTitle: execution.dealTitle,
      dealTitleStartsWithTestPrefix: execution.dealTitleStartsWithTestPrefix,
      paidStageId: execution.paidStageId,
      runnerDirectBackendTrigger: false,
      backendTriggerRequestSent: false,
      bitrixAutomationExpected: true,
      n8nTriggerExpected: true,
      backendWorkflowMayHaveExecuted: execution.backendWorkflowMayHaveExecuted,
      backendSideEffectsMayHaveOccurred: execution.backendSideEffectsMayHaveOccurred,
      webhookConfigured: execution.webhookConfigured,
      webhookMasked: execution.webhookMasked,
      secretDisplayed: false,
      resultStatus: execution.resultStatus,
      warnings: execution.warnings,
      errors: execution.errors,
    },
    summary,
  };
}
