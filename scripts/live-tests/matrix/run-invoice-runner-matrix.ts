import {
  INVOICE_RUNNER_MATRIX_CASES,
  assertInvoiceRunnerMatrixCounts,
} from './invoice-runner-matrix.cases';
import { executeInvoiceRunnerMatrixCase } from './execute-invoice-runner-matrix-case';
import type {
  InvoiceRunnerMatrixCaseResult,
  InvoiceRunnerMatrixRunSummary,
} from './invoice-runner-matrix.types';

export async function runInvoiceRunnerMatrix(
  cases = INVOICE_RUNNER_MATRIX_CASES,
): Promise<InvoiceRunnerMatrixRunSummary> {
  assertInvoiceRunnerMatrixCounts(cases);

  const results: InvoiceRunnerMatrixCaseResult[] = [];

  for (const matrixCase of cases) {
    if (matrixCase.expected.result === 'BACKEND_VALIDATION_REJECT') {
      continue;
    }

    results.push(await executeInvoiceRunnerMatrixCase(matrixCase));
  }

  return buildSummary(cases.length, results);
}

export function buildSummary(
  totalDefinedCases: number,
  results: InvoiceRunnerMatrixCaseResult[],
): InvoiceRunnerMatrixRunSummary {
  const passed = results.filter((result) => result.passed).length;
  const failed = results.filter((result) => !result.passed).length;

  const byInvoiceType = {
    FULL: summarizeType(results, 'FULL'),
    ADVANCE: summarizeType(results, 'ADVANCE'),
    FINAL: summarizeType(results, 'FINAL'),
  };

  return {
    totalCases: totalDefinedCases,
    passed,
    failed,
    byInvoiceType,
    failures: results.filter((result) => !result.passed),
  };
}

function summarizeType(
  results: InvoiceRunnerMatrixCaseResult[],
  invoiceType: InvoiceRunnerMatrixCaseResult['invoiceType'],
): { total: number; passed: number; failed: number } {
  const filtered = results.filter((result) => result.invoiceType === invoiceType);
  const passed = filtered.filter((result) => result.passed).length;

  return {
    total: filtered.length,
    passed,
    failed: filtered.length - passed,
  };
}
