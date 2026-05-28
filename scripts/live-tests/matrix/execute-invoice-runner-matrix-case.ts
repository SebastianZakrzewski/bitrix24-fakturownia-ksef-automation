import {
  BackendDryRunAdapterError,
  simulateBackendDryRunWorkflow,
} from '../adapters/backend-dry-run.adapter';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import {
  BackendDryRunContractValidationError,
  validateBackendDryRunContract,
} from '../contracts/validate-backend-dry-run-contract';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import type { InvoiceRunnerMatrixCase, InvoiceRunnerMatrixCaseResult } from './invoice-runner-matrix.types';

const noopFetch: typeof fetch = () =>
  Promise.reject(new Error('fetch must not be called in invoice runner matrix'));

function passResult(
  matrixCase: InvoiceRunnerMatrixCase,
  message: string,
): InvoiceRunnerMatrixCaseResult {
  return {
    caseId: matrixCase.id,
    invoiceType: matrixCase.invoiceType,
    passed: true,
    actualResult: 'RUNNER_PASS',
    message,
  };
}

function failResult(
  matrixCase: InvoiceRunnerMatrixCase,
  actualResult: InvoiceRunnerMatrixCaseResult['actualResult'],
  message: string,
  errorCode?: string,
): InvoiceRunnerMatrixCaseResult {
  return {
    caseId: matrixCase.id,
    invoiceType: matrixCase.invoiceType,
    passed: false,
    actualResult,
    message,
    errorCode,
  };
}

export async function executeInvoiceRunnerMatrixCase(
  matrixCase: InvoiceRunnerMatrixCase,
): Promise<InvoiceRunnerMatrixCaseResult> {
  if (matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT') {
    return failResult(
      matrixCase,
      'BACKEND_VALIDATION_REJECT',
      'Backend validation cases must run via invoice-runner-matrix.spec.ts',
    );
  }

  const input = matrixCase.prepare();

  if (matrixCase.expected.result === 'ADAPTER_REJECT') {
    if (!input.context) {
      return failResult(
        matrixCase,
        'ADAPTER_REJECT',
        'Matrix case missing context for ADAPTER_REJECT',
      );
    }

    try {
      simulateBackendDryRunWorkflow(input.context);
      return failResult(
        matrixCase,
        'ADAPTER_REJECT',
        'Expected adapter rejection but workflow succeeded',
      );
    } catch (error: unknown) {
      if (!(error instanceof BackendDryRunAdapterError)) {
        return failResult(
          matrixCase,
          'ADAPTER_REJECT',
          `Expected BackendDryRunAdapterError, got ${error instanceof Error ? error.name : String(error)}`,
        );
      }

      return passResult(matrixCase, error.message);
    }
  }

  if (matrixCase.expected.result === 'CONTRACT_REJECT') {
    if (!input.context) {
      return failResult(
        matrixCase,
        'CONTRACT_REJECT',
        'Matrix case missing context for CONTRACT_REJECT',
      );
    }

    if (!input.contractOverride) {
      return failResult(
        matrixCase,
        'CONTRACT_REJECT',
        'Matrix case missing contractOverride for CONTRACT_REJECT',
      );
    }

    try {
      const { contract } = simulateBackendDryRunWorkflow(input.context);
      validateBackendDryRunContract(input.contractOverride(contract));
      return failResult(
        matrixCase,
        'CONTRACT_REJECT',
        `Expected contract code ${matrixCase.expected.code}`,
      );
    } catch (error: unknown) {
      if (!(error instanceof BackendDryRunContractValidationError)) {
        return failResult(
          matrixCase,
          'CONTRACT_REJECT',
          `Expected BackendDryRunContractValidationError, got ${error instanceof Error ? error.name : String(error)}`,
        );
      }

      if (error.code !== matrixCase.expected.code) {
        return failResult(
          matrixCase,
          'CONTRACT_REJECT',
          `Expected code ${matrixCase.expected.code}, got ${error.code}`,
          error.code,
        );
      }

      return passResult(matrixCase, error.message);
    }
  }

  if (!input.context) {
    return failResult(matrixCase, 'RUNNER_PASS', 'Matrix case missing context for RUNNER_PASS');
  }

  if (input.contractOverride) {
    return failResult(
      matrixCase,
      'RUNNER_PASS',
      'RUNNER_PASS must not use contractOverride',
    );
  }

  try {
    simulateBackendDryRunWorkflow(input.context);
  } catch (error: unknown) {
    return failResult(
      matrixCase,
      'RUNNER_PASS',
      `Adapter rejected valid context: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const contract = mapBackendDryRunContract(input.context);
  validateBackendDryRunContract(contract);

  const scenarioResult = await executeDryRunScenario({
    context: input.context,
    fetchImpl: noopFetch,
    triggerPreflightEnv: {},
  });

  if (scenarioResult.status !== 'DRY_RUN_COMPLETED') {
    return failResult(
      matrixCase,
      'RUNNER_PASS',
      `Expected DRY_RUN_COMPLETED, got ${scenarioResult.status}`,
    );
  }

  if (scenarioResult.externalSideEffectsExecuted) {
    return failResult(
      matrixCase,
      'RUNNER_PASS',
      'Runner reported external side effects',
    );
  }

  if (scenarioResult.backendDryRun?.useCaseExecuted) {
    return failResult(matrixCase, 'RUNNER_PASS', 'Use case execution must remain false');
  }

  if (scenarioResult.backendDryRun?.dbWriteExecuted) {
    return failResult(matrixCase, 'RUNNER_PASS', 'DB write must remain false');
  }

  if (scenarioResult.backendDryRun?.backendEndpointCalled) {
    return failResult(matrixCase, 'RUNNER_PASS', 'Backend endpoint must not be called');
  }

  return passResult(
    matrixCase,
    `Dry-run completed for ${input.context.testContextId}`,
  );
}
