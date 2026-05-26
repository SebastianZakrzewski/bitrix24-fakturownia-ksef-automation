import type { LiveTestReport } from '../types/live-test-report.types';
import type { BackendTriggerExecutionResult } from './backend-trigger-execution.types';

export function toBackendTriggerExecutionReport(
  result: BackendTriggerExecutionResult,
): LiveTestReport['backendTriggerExecution'] {
  return {
    mode: result.mode,
    executionKind: result.executionKind,
    scenarioType: result.scenarioType,
    gate: result.gate,
    target: result.target,
    request: result.request,
    response: result.response,
    runnerDirect: result.runnerDirect,
    systemEffects: result.systemEffects,
    resultStatus: result.resultStatus,
    warnings: result.warnings,
    errors: result.errors,
  };
}
