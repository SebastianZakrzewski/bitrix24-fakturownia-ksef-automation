import './load-env';
import { runInvoiceRunnerMatrix } from './matrix/run-invoice-runner-matrix';

async function main(): Promise<void> {
  const summary = await runInvoiceRunnerMatrix();

  console.log('Invoice runner matrix (runner-layer cases only):');
  console.log(`  Total defined matrix cases: ${summary.totalCases}`);
  console.log(`  Runner-layer executed: ${summary.passed + summary.failed}`);
  console.log(`  Passed: ${summary.passed}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(
    `  FULL: ${summary.byInvoiceType.FULL.passed}/${summary.byInvoiceType.FULL.total}`,
  );
  console.log(
    `  ADVANCE: ${summary.byInvoiceType.ADVANCE.passed}/${summary.byInvoiceType.ADVANCE.total}`,
  );
  console.log(
    `  FINAL: ${summary.byInvoiceType.FINAL.passed}/${summary.byInvoiceType.FINAL.total}`,
  );
  console.log('');
  console.log(
    'Run `npm run live-test:matrix` (jest) for all 120 cases including backend validation guards.',
  );

  if (summary.failures.length > 0) {
    for (const failure of summary.failures) {
      console.error(`  FAIL ${failure.caseId}: ${failure.message}`);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
