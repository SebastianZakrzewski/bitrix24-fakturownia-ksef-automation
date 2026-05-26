import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import type { LiveTestReport } from '../types/live-test-report.types';
import {
  assertDryRunMarkdown,
  assertDryRunReport,
  assertDryRunScenarioRequirements,
  assertForbiddenDryRunReportStates,
  DryRunReportAssertionError,
} from './assert-dry-run-report';
import { buildLiveTestReport } from './build-live-test-report';
import type { ExpectedDryRunScenarioId } from './expected-dry-run-report.shape';
import {
  compareNormalizedDryRunReports,
  normalizeDryRunReport,
} from './normalize-dry-run-report';
import { buildLiveTestReportMarkdown } from './report-writer';

const validEnv: LiveTestEnv = {
  LIVE_TEST_MODE: true,
  LIVE_TEST_CONFIRM: false,
  ENABLE_EXTERNAL_SIDE_EFFECTS: false,
  ALLOW_TEST_DEAL_CREATION: false,
  TEST_DEAL_PREFIX: '[TEST]',
  ALLOW_BULK_LIVE_TESTS: false,
  ALLOW_DELETE_OR_CANCEL: false,
  LIVE_TEST_ALLOW_BACKEND_TRIGGER_EXECUTION: false,
};

import {
  restoreLiveTestEnvKeys,
  saveAndClearLiveTestEnvKeys,
} from '../isolate-live-test-env';

const scenarios = [
  { id: 'full' as const, scenario: fullInvoiceScenario },
  { id: 'advance' as const, scenario: advanceInvoiceScenario },
  { id: 'final' as const, scenario: finalInvoiceScenario },
];

async function buildScenarioReport(
  scenarioId: ExpectedDryRunScenarioId,
): Promise<LiveTestReport> {
  const entry = scenarios.find((item) => item.id === scenarioId);
  if (!entry) {
    throw new Error(`Unknown scenario ${scenarioId}`);
  }

  const startedAt = new Date('2026-05-26T12:00:00.000Z');
  const finishedAt = new Date('2026-05-26T12:00:05.000Z');
  const scenarioResult = await entry.scenario.run();

  return buildLiveTestReport({
    scenario: entry.scenario,
    scenarioResult,
    safetyChecks: collectSafetyChecks(validEnv, entry.scenario.safetyContext),
    startedAt,
    finishedAt,
    reportWritten: true,
    smokeReadinessConfig: {},
  });
}

describe('assertDryRunReport', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    Object.assign(savedEnv, saveAndClearLiveTestEnvKeys());
  });

  afterEach(() => {
    restoreLiveTestEnvKeys(savedEnv);
    Object.keys(savedEnv).forEach((key) => delete savedEnv[key]);
  });

  it.each(scenarios)(
    '$id JSON report matches expected dry-run requirements',
    async ({ id, scenario: _scenario }) => {
      const report = await buildScenarioReport(id);
      expect(() => assertDryRunReport(report, id)).not.toThrow();
    },
  );

  it.each(scenarios)(
    '$id Markdown report contains expected dry-run content',
    async ({ id }) => {
      const report = await buildScenarioReport(id);
      const markdown = buildLiveTestReportMarkdown(report);
      expect(() => assertDryRunMarkdown(markdown, id, report)).not.toThrow();
    },
  );

  it('comparison does not fail only because timestamps differ', async () => {
    const early = await buildScenarioReport('full');
    const late = {
      ...early,
      meta: {
        ...early.meta,
        startedAt: '2027-01-01T00:00:00.000Z',
        finishedAt: '2027-01-01T00:00:10.000Z',
        runnerVersion: '9.9.9-test',
      },
    };

    expect(early.meta.startedAt).not.toBe(late.meta.startedAt);
    expect(
      compareNormalizedDryRunReports(
        normalizeDryRunReport(early),
        normalizeDryRunReport(late),
      ),
    ).toBe(true);
  });

  it('fails if productionReadiness becomes READY', async () => {
    const report = await buildScenarioReport('full');
    const invalid = {
      ...report,
      productionReadiness: 'READY',
    } as unknown as LiveTestReport;

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      DryRunReportAssertionError,
    );
    expect(() => assertDryRunReport(invalid, 'full')).toThrow(
      /productionReadiness must be NOT_READY/,
    );
  });

  it('fails if externalSideEffectsExecuted becomes true', async () => {
    const report = await buildScenarioReport('advance');
    const invalid = {
      ...report,
      externalSideEffectsExecuted: true,
    } as unknown as LiveTestReport;

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      DryRunReportAssertionError,
    );
  });

  it('fails if Bitrix integration step becomes PASSED (executed)', async () => {
    const report = await buildScenarioReport('final');
    const invalid: LiveTestReport = {
      ...report,
      integrations: {
        ...report.integrations,
        bitrixDealSetup: 'PASSED',
      },
    };

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      /must not be executed/,
    );
  });

  it('fails if backend workflow step becomes PASSED (executed)', async () => {
    const report = await buildScenarioReport('full');
    const invalid: LiveTestReport = {
      ...report,
      integrations: {
        ...report.integrations,
        backendWorkflow: 'PASSED',
      },
    };

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      DryRunReportAssertionError,
    );
  });

  it('fails if Fakturownia invoice step becomes PASSED (executed)', async () => {
    const report = await buildScenarioReport('advance');
    const invalid: LiveTestReport = {
      ...report,
      integrations: {
        ...report.integrations,
        fakturowniaInvoice: 'PASSED',
      },
    };

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      DryRunReportAssertionError,
    );
  });

  it('fails if KSeF is marked as confirmed', async () => {
    const report = await buildScenarioReport('full');
    const invalid = {
      ...report,
      integrations: {
        ...report.integrations,
        ksef: 'CONFIRMED',
      },
    } as unknown as LiveTestReport;

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      /KSeF must be MANUAL_REQUIRED/,
    );
  });

  it('fails if Bitrix sync is marked as synced', async () => {
    const report = await buildScenarioReport('final');
    const invalid = {
      ...report,
      bitrixSyncStatus: 'SYNCED',
    } as unknown as LiveTestReport;

    expect(() => assertForbiddenDryRunReportStates(invalid)).toThrow(
      /Bitrix sync must be NOT_TESTED_YET/,
    );
  });

  it('fails if [TEST] prefix is missing from bitrixDealId', async () => {
    const report = await buildScenarioReport('full');
    const invalid: LiveTestReport = {
      ...report,
      fixture: {
        ...report.fixture,
        bitrixDealId: 'PRODUCTION-DEAL-001',
      },
      scenario: report.scenario.context
        ? {
            ...report.scenario,
            context: {
              ...report.scenario.context,
              bitrixDealId: 'PRODUCTION-DEAL-001',
            },
          }
        : report.scenario,
    };

    expect(() => assertDryRunScenarioRequirements(invalid, 'full')).toThrow(
      /must start with \[TEST\]/,
    );
  });

  it('fails if scenarioType does not match expectedInvoiceType', async () => {
    const report = await buildScenarioReport('advance');
    const invalid: LiveTestReport = {
      ...report,
      fixture: {
        ...report.fixture,
        scenarioType: 'ADVANCE',
        expectedInvoiceType: 'FINAL',
      },
    };

    expect(() => assertDryRunScenarioRequirements(invalid, 'advance')).toThrow(
      /expectedInvoiceType must match scenarioType/,
    );
  });

  it('Markdown assertion fails on forbidden READY text', async () => {
    const report = await buildScenarioReport('full');
    const markdown = `${buildLiveTestReportMarkdown(report)}\n- Status: **READY**`;

    expect(() => assertDryRunMarkdown(markdown, 'full', report)).toThrow(
      DryRunReportAssertionError,
    );
  });
});
