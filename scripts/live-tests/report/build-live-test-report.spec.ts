import { buildLiveTestReport } from './build-live-test-report';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
};

describe('buildLiveTestReport', () => {
  it('never marks production readiness as READY', async () => {
    const scenarioResult = await fullInvoiceScenario.run();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(
        validEnv,
        fullInvoiceScenario.safetyContext,
      ),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: false,
    });

    expect(report.productionReadiness).toBe('NOT_READY');
    expect(report.externalSideEffectsExecuted).toBe(false);
    expect(report.backendContract.contractValidationStatus).toBe('PASSED');
    expect(report.backendDryRun.resultStatus).toBe('BACKEND_DRY_RUN_SIMULATED');
    expect(report.integrations.backendWorkflow).toBe('BACKEND_DRY_RUN_SIMULATED');
    expect(report.backendDryRun.dbWriteExecuted).toBe(false);
  });
});
