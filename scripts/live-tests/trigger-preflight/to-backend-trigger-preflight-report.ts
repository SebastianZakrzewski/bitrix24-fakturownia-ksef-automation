import type { LiveTestReport } from '../types/live-test-report.types';
import type { BackendTriggerPreflightResult } from './backend-trigger-preflight.types';

export function toBackendTriggerPreflightReport(
  result: BackendTriggerPreflightResult,
): LiveTestReport['backendTriggerPreflight'] {
  return {
    mode: result.mode,
    preflightKind: result.preflightKind,
    scenarioType: result.scenarioType,
    target: {
      method: result.target.method,
      path: result.target.path,
      baseUrlConfigured: result.target.baseUrlConfigured,
      authHeaderNameConfigured: result.target.authHeaderNameConfigured,
      authSecretConfigured: result.target.authSecretConfigured,
      secretDisplayed: false,
    },
    request: {
      payloadShapeValid: result.request.payloadShapeValid,
      bitrix_deal_id: result.request.payload.bitrix_deal_id,
      trigger_source: result.request.payload.trigger_source,
      trigger_stage_id: result.request.payload.trigger_stage_id,
      triggered_at: result.request.payload.triggered_at,
    },
    executionPolicy: result.executionPolicy,
    execution: {
      requestSent: result.execution.requestSent,
      endpointCalled: result.execution.endpointCalled,
      workflowExecuted: result.execution.workflowExecuted,
      dbWriteExecuted: result.execution.dbWriteExecuted,
      bitrixCalled: result.execution.bitrixCalled,
      fakturowniaCalled: result.execution.fakturowniaCalled,
      ksefTested: result.execution.ksefTested,
    },
    liveSmokeTarget: result.liveSmokeTarget,
    preflightStatus: result.preflightStatus,
    blockers: result.blockers,
    warnings: result.warnings,
  };
}
