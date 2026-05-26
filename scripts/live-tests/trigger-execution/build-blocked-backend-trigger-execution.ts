import type { LiveTestInvoiceType, LiveTestReport } from '../types/live-test-report.types';

export function buildBlockedBackendTriggerExecution(
  scenarioType: LiveTestInvoiceType,
  blockers: string[] = ['Backend trigger execution was not run.'],
): LiveTestReport['backendTriggerExecution'] {
  return {
    mode: 'CONTROLLED_LIVE_TRIGGER_EXECUTION',
    executionKind: 'BACKEND_TRIGGER_EXECUTION',
    scenarioType,
    gate: {
      executionAllowed: false,
      triggerExecutionAllowed: false,
      blockers,
      warnings: [],
    },
    target: {
      method: 'POST',
      path: '/invoice-processes/bitrix-trigger',
      baseUrlConfigured: false,
      authHeaderNameConfigured: false,
      authSecretConfigured: false,
      secretDisplayed: false,
    },
    request: {
      payload: {
        bitrix_deal_id: 'blocked',
        trigger_source: 'BITRIX24_STAGE_CHANGE',
        trigger_stage_id: 'PREPARATION',
        triggered_at: '1970-01-01T00:00:00.000Z',
      },
      timeoutMs: 30_000,
    },
    execution: {
      requestSent: false,
      endpointCalled: false,
      workflowExecuted: false,
      invoiceProcessCreated: false,
      invoiceRecordCreated: false,
      dbWriteExecuted: false,
      bitrixCalled: false,
      fakturowniaCalled: false,
      ksefTested: false,
    },
    resultStatus: 'BACKEND_TRIGGER_EXECUTION_BLOCKED',
    warnings: [],
    errors: [],
  };
}
