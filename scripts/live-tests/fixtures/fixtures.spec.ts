import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { buildLiveTestReport } from '../report/build-live-test-report';
import { liveTestReportSchema } from '../types/live-test-report.types';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import { advanceInvoiceDryRunContext } from './advance-invoice.context';
import { finalInvoiceDryRunContext } from './final-invoice.context';
import { fullInvoiceDryRunContext } from './full-invoice.context';
import {
  assertSyntheticFixtureData,
  FORBIDDEN_REAL_DATA_MARKERS,
  hasTestDealPrefix,
} from './fixture-common';
import { liveTestFixtureByScenarioId } from './fixture-registry';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
};

function serializeFixture(fixture: object): string {
  return JSON.stringify(fixture);
}

describe('live-test fixtures', () => {
  it.each([
    ['full', fullInvoiceScenario, fullInvoiceDryRunContext],
    ['advance', advanceInvoiceScenario, advanceInvoiceDryRunContext],
    ['final', finalInvoiceScenario, finalInvoiceDryRunContext],
  ] as const)(
    '%s scenario uses matching fixture from registry',
    async (scenarioId, scenario, expectedFixture) => {
      expect(liveTestFixtureByScenarioId[scenarioId]).toBe(expectedFixture);

      const result = await scenario.run();

      expect(result.context).toBe(expectedFixture);
      expect(result.context?.scenarioType).toBe(expectedFixture.scenarioType);
      expect(result.context?.testContextId).toBe(expectedFixture.testContextId);
    },
  );

  it.each(Object.values(liveTestFixtureByScenarioId))(
    'fixture %s uses [TEST] deal prefix and synthetic data only',
    (fixture) => {
      expect(hasTestDealPrefix(fixture.bitrixDealId)).toBe(true);
      expect(fixture.testDealTitle).toContain('[TEST]');
      expect(fixture.buyer.companyName).toContain('[TEST]');

      const serialized = serializeFixture(fixture);
      assertSyntheticFixtureData(serialized);

      for (const pattern of FORBIDDEN_REAL_DATA_MARKERS) {
        expect(serialized).not.toMatch(pattern);
      }
    },
  );

  it('reports include fixture summary and fixed safety statuses', async () => {
    const result = await fullInvoiceScenario.run();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult: result,
      safetyChecks: collectSafetyChecks(
        validEnv,
        fullInvoiceScenario.safetyContext,
      ),
      startedAt: new Date(),
      finishedAt: new Date(),
      reportWritten: true,
    });

    const parsed = liveTestReportSchema.parse(report);

    expect(parsed.mode).toBe('DRY_RUN');
    expect(parsed.productionReadiness).toBe('NOT_READY');
    expect(parsed.ksefStatus).toBe('MANUAL_REQUIRED');
    expect(parsed.bitrixSyncStatus).toBe('NOT_TESTED_YET');
    expect(parsed.externalSideEffectsExecuted).toBe(false);
    expect(parsed.fixture.testContextId).toBe('test-context-full-001');
    expect(parsed.fixture.scenarioType).toBe('FULL');
    expect(parsed.fixture.bitrixDealId).toBe('[TEST]-FULL-001');
    expect(parsed.fixture.advanceAmountPln).toBeUndefined();
    expect(parsed.integrations.bitrixDealSetup).toBe('SKIPPED_NOT_EXECUTED');
    expect(parsed.integrations.backendWorkflow).toBe('SKIPPED_NOT_EXECUTED');
    expect(parsed.integrations.fakturowniaInvoice).toBe('SKIPPED_NOT_EXECUTED');
  });

  it('fixture execution does not call external systems', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();

    try {
      await Promise.all([
        fullInvoiceScenario.run(),
        advanceInvoiceScenario.run(),
        finalInvoiceScenario.run(),
      ]);

      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }

  });
});
