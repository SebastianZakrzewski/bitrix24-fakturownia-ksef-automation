import './load-env';
import { buildBitrixE2eSetupReport } from './report/build-bitrix-e2e-setup-report';
import { assertBitrixE2eSetupReport } from './report/assert-bitrix-e2e-setup-report';
import { writeBitrixE2eSetupReport } from './report/write-bitrix-e2e-setup-report';
import {
  parseLiveTestEnv,
  resolveLiveTestReportDir,
} from './live-test-env';
import {
  fullBitrixE2eSetupSafetyContext,
  runFullBitrixE2eSetupScenario,
} from './scenarios/full-bitrix-e2e-setup.scenario';
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

  try {
    const safetyChecks = validateSafetyGuards(env, fullBitrixE2eSetupSafetyContext);
    const { execution } = await runFullBitrixE2eSetupScenario();
    const finishedAt = new Date();

    const report = buildBitrixE2eSetupReport({
      execution,
      safetyChecks,
      startedAt,
      finishedAt,
    });

    assertBitrixE2eSetupReport(report);

    const output = await writeBitrixE2eSetupReport(report, {
      outputDir: resolveLiveTestReportDir(env),
      timestamp: finishedAt,
    });

    console.log('Bitrix E2E setup report written:');
    console.log(`  JSON: ${output.jsonPath}`);
    console.log(`  Markdown: ${output.markdownPath}`);
    console.log(`  Setup result: ${report.bitrixE2eSetup.resultStatus}`);
    console.log(`  Manual verification required: ${report.manualVerificationRequired}`);

    if (report.bitrixE2eSetup.resultStatus === 'BITRIX_E2E_SETUP_BLOCKED') {
      process.exit(1);
    }
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
