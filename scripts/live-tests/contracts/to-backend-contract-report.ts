import type { BackendDryRunContract } from './backend-dry-run-contract.types';
import type { BackendDryRunContractReport } from './backend-dry-run-contract.types';
import { backendDryRunContractReportSchema } from './backend-dry-run-contract.types';

export function toBackendDryRunContractReport(
  contract: BackendDryRunContract,
): BackendDryRunContractReport {
  const report: BackendDryRunContractReport = {
    mode: contract.mode,
    scenarioType: contract.scenarioType,
    expectedInvoiceType: contract.expectedInvoiceType,
    trigger: contract.trigger,
    executionPolicy: contract.executionPolicy,
    contractValidationStatus: 'PASSED',
  };

  return backendDryRunContractReportSchema.parse(report);
}
