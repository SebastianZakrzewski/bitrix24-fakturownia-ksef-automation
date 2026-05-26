import './load-env';
import { buildLiveTestReport } from './report/build-live-test-report';
import { assertLiveTriggerSmokeReport } from './report/assert-live-trigger-smoke-report';
import { writeLiveTestReport } from './report/report-writer';
import {
  parseLiveTestEnv,
  resolveLiveTestReportDir,
} from './live-test-env';
import { fullInvoiceTriggerSmokeScenario } from './scenarios/full-invoice-trigger-smoke.scenario';
import { LiveTestGuardError, validateSafetyGuards } from './safety-guards';

async function main(): Promise<void> {
  const startedAt = new Date();

  let env;
  try {
    env = parseLiveTestEnv(process.env);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const scenario = fullInvoiceTriggerSmokeScenario;

  try {
    const safetyChecks = validateSafetyGuards(env, scenario.safetyContext);
    const scenarioResult = await scenario.run();
    const finishedAt = new Date();

    const report = buildLiveTestReport({
      scenario,
      scenarioResult,
      safetyChecks,
      startedAt,
      finishedAt,
      reportWritten: true,
    });

    assertLiveTriggerSmokeReport(report);

    const output = await writeLiveTestReport(report, {
      outputDir: resolveLiveTestReportDir(env),
      timestamp: finishedAt,
    });

    console.log('Live test controlled trigger smoke report written:');
    console.log(`  JSON: ${output.jsonPath}`);
    console.log(`  Markdown: ${output.markdownPath}`);
    console.log(
      `  Trigger execution: ${report.backendTriggerExecution.resultStatus}`,
    );
    console.log(`  Manual verification required: ${report.manualVerificationRequired}`);
  } catch (error: unknown) {
    if (error instanceof LiveTestGuardError) {
      console.error(`Live test refused (${error.code}): ${error.message}`);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
