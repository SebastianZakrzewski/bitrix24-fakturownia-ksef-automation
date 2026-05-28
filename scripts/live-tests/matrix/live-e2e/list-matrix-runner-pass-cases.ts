import { INVOICE_RUNNER_MATRIX_CASES } from '../invoice-runner-matrix.cases';
import type { InvoiceRunnerMatrixCase } from '../invoice-runner-matrix.types';

export function listMatrixRunnerPassCases(
  cases: InvoiceRunnerMatrixCase[] = INVOICE_RUNNER_MATRIX_CASES,
): InvoiceRunnerMatrixCase[] {
  return cases.filter((matrixCase) => matrixCase.expected.result === 'RUNNER_PASS');
}

export function assertMatrixRunnerPassCaseCounts(
  cases: InvoiceRunnerMatrixCase[] = listMatrixRunnerPassCases(),
): void {
  const counts = {
    FULL: cases.filter((item) => item.invoiceType === 'FULL').length,
    ADVANCE: cases.filter((item) => item.invoiceType === 'ADVANCE').length,
    FINAL: cases.filter((item) => item.invoiceType === 'FINAL').length,
  };

  if (counts.FULL !== 15 || counts.ADVANCE !== 15 || counts.FINAL !== 15) {
    throw new Error(
      `Matrix live E2E expects 15 runner-pass cases per type; got FULL=${counts.FULL}, ADVANCE=${counts.ADVANCE}, FINAL=${counts.FINAL}`,
    );
  }

  if (cases.length !== 45) {
    throw new Error(`Matrix live E2E expects 45 runner-pass cases; got ${cases.length}`);
  }
}
