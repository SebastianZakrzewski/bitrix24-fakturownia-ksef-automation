import type { MatrixBackendTriggerOutcome } from './matrix-backend-trigger.types';

export const MATRIX_LIVE_E2E_MODE = 'MATRIX_LIVE_E2E' as const;
export const MATRIX_LIVE_E2E_RUNNER_VERSION = '1.1.0-matrix-live-e2e-backend-trigger';

export type MatrixLiveE2eCaseStatus =
  | 'MATRIX_LIVE_E2E_BLOCKED'
  | 'MATRIX_LIVE_E2E_COMPLETED'
  | 'MATRIX_LIVE_E2E_FAILED';

export interface MatrixLiveE2eCaseResult {
  caseId: string;
  invoiceType: 'FULL' | 'ADVANCE' | 'FINAL';
  description: string;
  matrixCaseId: string;
  status: MatrixLiveE2eCaseStatus;
  dealTitle: string;
  bitrixDealId?: string;
  bitrixCompanyId?: string;
  paidStageId: string;
  realBitrixMutationExecuted: boolean;
  bitrixDealCreated: boolean;
  bitrixDealUpdated: boolean;
  bitrixStageChanged: boolean;
  runnerDirectBackendTrigger: boolean;
  backendTriggerRequestSent: boolean;
  backendTrigger?: MatrixBackendTriggerOutcome;
  advanceSeedBackendTrigger?: MatrixBackendTriggerOutcome;
  bitrixAutomationExpected: boolean;
  backendWorkflowMayHaveExecuted: boolean;
  backendSideEffectsMayHaveOccurred: boolean;
  gateBlockers: string[];
  warnings: string[];
  errors: string[];
  startedAt: string;
  finishedAt: string;
}

export interface MatrixLiveE2eRunSummary {
  mode: typeof MATRIX_LIVE_E2E_MODE;
  runnerVersion: string;
  startedAt: string;
  finishedAt: string;
  totalCases: number;
  completed: number;
  blocked: number;
  failed: number;
  backendTriggerEnabled: boolean;
  backendTriggerSent: number;
  backendTriggerWorkflowSuccess: number;
  byInvoiceType: Record<
    'FULL' | 'ADVANCE' | 'FINAL',
    { total: number; completed: number; blocked: number; failed: number }
  >;
  cases: MatrixLiveE2eCaseResult[];
}
