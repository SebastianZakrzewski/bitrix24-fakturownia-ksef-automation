import './load-env';
import { resolveLiveTestReportDir } from './live-test-env';
import { runInvoiceMatrixLiveE2e } from './matrix/live-e2e/run-invoice-matrix-live-e2e';
import { writeMatrixLiveE2eReport } from './matrix/live-e2e/write-matrix-live-e2e-report';

function parseCaseIds(argv: string[]): string[] | undefined {
  const fromArgs = argv
    .flatMap((arg) => {
      if (arg.startsWith('--case=')) {
        return arg.slice('--case='.length).split(',');
      }

      if (arg === '--case' || arg === '-c') {
        return [];
      }

      return [];
    })
    .map((item) => item.trim())
    .filter(Boolean);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if ((arg === '--case' || arg === '-c') && argv[index + 1]) {
      fromArgs.push(
        ...argv[index + 1]!
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      );
    }
  }

  const fromEnv = process.env.LIVE_TEST_MATRIX_CASE_IDS?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const ids = [...fromArgs, ...(fromEnv ?? [])];
  return ids.length > 0 ? [...new Set(ids)] : undefined;
}

async function main(): Promise<void> {
  const caseIds = parseCaseIds(process.argv.slice(2));
  const { env, summary } = await runInvoiceMatrixLiveE2e({ caseIds });

  const output = await writeMatrixLiveE2eReport(summary, {
    outputDir: resolveLiveTestReportDir(env),
    timestamp: new Date(summary.finishedAt),
  });

  console.log('Invoice matrix live E2E report written:');
  console.log(`  JSON: ${output.jsonPath}`);
  console.log(`  Markdown: ${output.markdownPath}`);
  console.log(`  Total: ${summary.totalCases}`);
  console.log(`  Completed: ${summary.completed}`);
  console.log(`  Blocked: ${summary.blocked}`);
  console.log(`  Failed: ${summary.failed}`);
  console.log(`  Backend trigger enabled: ${summary.backendTriggerEnabled}`);
  console.log(`  Backend trigger sent: ${summary.backendTriggerSent}`);
  console.log(`  Backend workflow success: ${summary.backendTriggerWorkflowSuccess}`);

  if (summary.blocked > 0 || summary.failed > 0) {
    for (const item of summary.cases) {
      if (item.status !== 'MATRIX_LIVE_E2E_COMPLETED') {
        console.error(
          `  ${item.caseId}: ${item.status} — ${item.errors.join('; ') || item.gateBlockers.join('; ')}`,
        );
      }
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
