export type MatrixBackendTriggerResultStatus =
  | 'SKIPPED'
  | 'BLOCKED'
  | 'SENT'
  | 'FAILED'
  | 'TIMEOUT';

export interface MatrixBackendTriggerOutcome {
  enabled: boolean;
  executionAllowed: boolean;
  requestSent: boolean;
  httpStatus?: number;
  triggerStatus?: string;
  processId?: string;
  message?: string;
  resultStatus: MatrixBackendTriggerResultStatus;
  blockers: string[];
  warnings: string[];
  errors: string[];
}

export const BACKEND_TRIGGER_FAILURE_STATUSES = new Set([
  'VALIDATION_FAILED',
  'FAKTUROWNIA_ERROR',
  'STALE_TRIGGER_IGNORED',
  'UNKNOWN_AFTER_TIMEOUT',
  'MANUAL_REVIEW_REQUIRED',
]);

export function isMatrixBackendTriggerWorkflowSuccess(input: {
  httpStatus?: number;
  triggerStatus?: string;
}): boolean {
  if (input.httpStatus !== 202) {
    return false;
  }

  if (!input.triggerStatus) {
    return false;
  }

  return !BACKEND_TRIGGER_FAILURE_STATUSES.has(input.triggerStatus);
}
