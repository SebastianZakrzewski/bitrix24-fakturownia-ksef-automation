import type { BackendDryRunContract } from '../contracts/backend-dry-run-contract.types';
import type { BackendDryRunContractValidationCode } from '../contracts/validate-backend-dry-run-contract';
import type { LiveTestScenarioContext } from '../fixtures/scenario-context.types';
import type { LiveTestInvoiceType } from '../types/live-test-report.types';

export type InvoiceRunnerMatrixCategory =
  | 'happy_path'
  | 'valid_variant'
  | 'contract_guard'
  | 'adapter_guard'
  | 'backend_validation_guard';

export type InvoiceRunnerMatrixExpectedResult =
  | { result: 'RUNNER_PASS' }
  | { result: 'ADAPTER_REJECT' }
  | {
      result: 'CONTRACT_REJECT';
      code: BackendDryRunContractValidationCode;
    }
  | {
      result: 'BACKEND_VALIDATION_REJECT';
      codes: readonly string[];
    };

export interface InvoiceRunnerMatrixCaseInput {
  context?: LiveTestScenarioContext;
  contractOverride?: (contract: BackendDryRunContract) => BackendDryRunContract;
}

export interface InvoiceRunnerMatrixCase {
  id: string;
  invoiceType: LiveTestInvoiceType;
  category: InvoiceRunnerMatrixCategory;
  description: string;
  prepare: () => InvoiceRunnerMatrixCaseInput;
  expected: InvoiceRunnerMatrixExpectedResult;
}

export interface InvoiceRunnerMatrixCaseResult {
  caseId: string;
  invoiceType: LiveTestInvoiceType;
  passed: boolean;
  actualResult: InvoiceRunnerMatrixExpectedResult['result'];
  message: string;
  errorCode?: string;
}

export interface InvoiceRunnerMatrixRunSummary {
  totalCases: number;
  passed: number;
  failed: number;
  byInvoiceType: Record<
    LiveTestInvoiceType,
    { total: number; passed: number; failed: number }
  >;
  failures: InvoiceRunnerMatrixCaseResult[];
}
