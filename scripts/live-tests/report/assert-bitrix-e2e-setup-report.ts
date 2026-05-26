import { bitrixE2eSetupReportSchema, type BitrixE2eSetupReport } from '../types/bitrix-e2e-setup-report.types';

const FORBIDDEN_REPORT_SUBSTRINGS = [
  'BITRIX24_WEBHOOK_URL=',
  'LIVE_TEST_BITRIX_AUTH_SECRET=',
  'FAKTUROWNIA_API_TOKEN',
  'se41mx3ts2o2nikj',
  'eyJhbGci',
];

export function assertBitrixE2eSetupReport(report: BitrixE2eSetupReport): void {
  bitrixE2eSetupReportSchema.parse(report);

  if (report.runnerDirectBackendTrigger !== false) {
    throw new Error('runnerDirectBackendTrigger must be false');
  }

  if (report.backendTriggerRequestSent !== false) {
    throw new Error('backendTriggerRequestSent must be false');
  }

  if (report.productionReadiness !== 'NOT_READY') {
    throw new Error('productionReadiness must be NOT_READY');
  }

  if (report.bitrixE2eSetup.secretDisplayed !== false) {
    throw new Error('secretDisplayed must be false');
  }

  if (!report.realBitrixMutationExecuted) {
    if (report.bitrixDealCreated) {
      throw new Error('bitrixDealCreated must be false when realBitrixMutationExecuted is false');
    }
    if (report.bitrixStageChanged) {
      throw new Error('bitrixStageChanged must be false when realBitrixMutationExecuted is false');
    }
    if (report.backendWorkflowMayHaveExecuted) {
      throw new Error(
        'backendWorkflowMayHaveExecuted must be false when realBitrixMutationExecuted is false',
      );
    }
    if (report.backendSideEffectsMayHaveOccurred) {
      throw new Error(
        'backendSideEffectsMayHaveOccurred must be false when realBitrixMutationExecuted is false',
      );
    }
    if (report.runnerDirectSideEffects.runnerDirectBitrixCall) {
      throw new Error(
        'runnerDirectBitrixCall must be false when realBitrixMutationExecuted is false',
      );
    }
    if (report.runnerDirectExternalSideEffectsExecuted) {
      throw new Error(
        'runnerDirectExternalSideEffectsExecuted must be false when realBitrixMutationExecuted is false',
      );
    }
  } else {
    if (!report.runnerDirectSideEffects.runnerDirectBitrixCall) {
      throw new Error(
        'runnerDirectBitrixCall must be true when realBitrixMutationExecuted is true',
      );
    }
    if (!report.runnerDirectExternalSideEffectsExecuted) {
      throw new Error(
        'runnerDirectExternalSideEffectsExecuted must be true when realBitrixMutationExecuted is true',
      );
    }
    if (!report.manualVerificationRequired) {
      throw new Error(
        'manualVerificationRequired must be true when realBitrixMutationExecuted is true',
      );
    }
  }

  if (
    report.bitrixStageChanged &&
    !report.backendWorkflowMayHaveExecuted
  ) {
    throw new Error(
      'backendWorkflowMayHaveExecuted must be true when bitrixStageChanged is true',
    );
  }

  if (
    report.bitrixStageChanged &&
    !report.backendSideEffectsMayHaveOccurred
  ) {
    throw new Error(
      'backendSideEffectsMayHaveOccurred must be true when bitrixStageChanged is true',
    );
  }

  const serialized = JSON.stringify(report);
  for (const forbidden of FORBIDDEN_REPORT_SUBSTRINGS) {
    if (serialized.includes(forbidden)) {
      throw new Error(`Report must not contain forbidden substring: ${forbidden}`);
    }
  }
}
