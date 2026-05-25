import '../../src/load-env';
import { buildLiveTestReport } from './report/build-live-test-report';
import { writeLiveTestReport } from './report/report-writer';
import {
  parseLiveTestEnv,
  resolveLiveTestReportDir,
} from './live-test-env';
import { listLiveTestScenarioIds, resolveLiveTestScenario } from './scenarios/scenario-registry';
import { LiveTestGuardError, validateSafetyGuards } from './safety-guards';

async function main(): Promise<void> {
  const scenarioId = process.argv[2];

  if (!scenarioId) {
    console.error(
      `Usage: ts-node scripts/live-tests/run-live-test.ts <${listLiveTestScenarioIds().join('|')}>`,
    );
    process.exit(1);
  }

  const startedAt = new Date();

  let scenario;
  try {
    scenario = resolveLiveTestScenario(scenarioId);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  let env;
  try {
    env = parseLiveTestEnv(process.env);
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

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
    });

    const output = await writeLiveTestReport(report, {
      outputDir: resolveLiveTestReportDir(env),
      timestamp: finishedAt,
    });

    console.log(`Live test report written:`);
    console.log(`  JSON: ${output.jsonPath}`);
    console.log(`  Markdown: ${output.markdownPath}`);
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
