import { fullInvoiceDryRunContext } from '../fixtures/full-invoice.context';
import { LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID } from '../live-smoke-target/live-smoke-target.types';
import { mapBackendDryRunContract } from '../contracts/map-backend-dry-run-contract';
import { runBackendTriggerPreflight } from '../trigger-preflight/run-backend-trigger-preflight';
import { executeDryRunScenario } from '../execution/dry-run-executor';
import { buildLiveTestReport } from './build-live-test-report';
import { buildLiveTestReportMarkdown } from './report-writer';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { collectSafetyChecks } from '../safety-guards';
import type { LiveTestEnv } from '../live-test-env';
import type { LiveTestReport } from '../types/live-test-report.types';
import {
  assertBitrixDealIdOnlyInApprovedMarkdownContexts,
  assertBitrixDealIdOnlyInApprovedReportFields,
  findUnapprovedMarkdownDealIdLines,
  isApprovedMarkdownLineForDealId,
  markdownForRealDataMarkerCheck,
} from './report-bitrix-deal-id-placement';
import {
  assertDryRunMarkdown,
  assertDryRunReport,
  DryRunReportAssertionError,
} from './assert-dry-run-report';
import { parseBackendSmokeReadinessConfig } from '../smoke-readiness/backend-smoke-readiness-config';
import {
  restoreLiveTestEnvKeys,
  saveAndClearLiveTestEnvKeys,
} from '../isolate-live-test-env';

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

const readyConfig = {
  LIVE_TEST_BACKEND_BASE_URL: 'http://localhost:3000',
  LIVE_TEST_BACKEND_TRIGGER_PATH: '/invoice-processes/bitrix-trigger',
  LIVE_TEST_BACKEND_AUTH_HEADER_NAME: 'x-api-key',
  LIVE_TEST_BACKEND_AUTH_SECRET: 'dummy-local-secret',
};

const smokeTargetEnv = {
  LIVE_TEST_ACTUAL_BITRIX_DEAL_ID: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
  LIVE_TEST_DEAL_LABEL: '[TEST] Runner FULL smoke test 001',
  LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED: 'false',
};

function minimalReportWithNumericDealId(): LiveTestReport {
  return {
    backendTriggerPreflight: {
      liveSmokeTarget: { actualBitrixDealId: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID },
      request: { bitrix_deal_id: LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID },
    },
  } as LiveTestReport;
}

describe('isApprovedMarkdownLineForDealId', () => {
  it('approves Actual Bitrix deal ID and payload bitrix_deal_id lines', () => {
    expect(
      isApprovedMarkdownLineForDealId(
        `- Actual Bitrix deal ID: **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
        LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
      ),
    ).toBe(true);
    expect(
      isApprovedMarkdownLineForDealId(
        `- Trigger payload deal ID (bitrix_deal_id): **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
        LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
      ),
    ).toBe(true);
  });

  it('rejects arbitrary leaked marker line', () => {
    expect(
      isApprovedMarkdownLineForDealId(
        `Arbitrary leaked real-data marker: ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
        LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
      ),
    ).toBe(false);
  });

  it('rejects deal id in notes, warnings, and errors sections', () => {
    const report = minimalReportWithNumericDealId();

    for (const line of [
      `- Note: customer deal ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
      `- Warning: retry for ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
      `- Error: failed for ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
    ]) {
      expect(isApprovedMarkdownLineForDealId(line, LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID)).toBe(
        false,
      );
      expect(findUnapprovedMarkdownDealIdLines(line, report)).toContain(line.trim());
    }
  });
});

describe('assertBitrixDealIdOnlyInApprovedMarkdownContexts', () => {
  it('passes when deal id appears only on approved lines', () => {
    const markdown = [
      '## Backend trigger preflight',
      `- Actual Bitrix deal ID: **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
      `- Trigger payload deal ID (bitrix_deal_id): **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
    ].join('\n');

    expect(() =>
      assertBitrixDealIdOnlyInApprovedMarkdownContexts(
        markdown,
        minimalReportWithNumericDealId(),
      ),
    ).not.toThrow();
  });

  it('fails when arbitrary leaked real-data marker line is appended', () => {
    const markdown = [
      `- Actual Bitrix deal ID: **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
      `Arbitrary leaked real-data marker: ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
    ].join('\n');

    expect(() =>
      assertBitrixDealIdOnlyInApprovedMarkdownContexts(
        markdown,
        minimalReportWithNumericDealId(),
      ),
    ).toThrow(/unapproved Markdown context/);
  });

  it('marker scan input still redacts only approved lines', () => {
    const markdown = [
      `- Actual Bitrix deal ID: **${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}**`,
      `Arbitrary leaked real-data marker: ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
    ].join('\n');
    const report = minimalReportWithNumericDealId();

    const scanned = markdownForRealDataMarkerCheck(markdown, report);
    expect(scanned).toContain('[CONFIGURED_BITRIX_DEAL_ID]');
    expect(scanned).toContain(
      `Arbitrary leaked real-data marker: ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`,
    );
  });
});

describe('report-bitrix-deal-id-placement integration', () => {
  const originalFetch = global.fetch;
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    Object.assign(savedEnv, saveAndClearLiveTestEnvKeys());
    global.fetch = jest.fn();
    process.env.LIVE_TEST_ACTUAL_BITRIX_DEAL_ID =
      smokeTargetEnv.LIVE_TEST_ACTUAL_BITRIX_DEAL_ID;
    process.env.LIVE_TEST_DEAL_LABEL = smokeTargetEnv.LIVE_TEST_DEAL_LABEL;
    process.env.LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED =
      smokeTargetEnv.LIVE_TEST_MANUAL_CRM_PREPARATION_CONFIRMED;
    process.env.LIVE_TEST_BACKEND_BASE_URL = readyConfig.LIVE_TEST_BACKEND_BASE_URL;
    process.env.LIVE_TEST_BACKEND_TRIGGER_PATH =
      readyConfig.LIVE_TEST_BACKEND_TRIGGER_PATH;
    process.env.LIVE_TEST_BACKEND_AUTH_HEADER_NAME =
      readyConfig.LIVE_TEST_BACKEND_AUTH_HEADER_NAME;
    process.env.LIVE_TEST_BACKEND_AUTH_SECRET =
      readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET;
  });

  afterEach(() => {
    restoreLiveTestEnvKeys(savedEnv);
    Object.keys(savedEnv).forEach((key) => delete savedEnv[key]);
    global.fetch = originalFetch;
  });

  it('allows example deal id only in approved JSON preflight fields', () => {
    const contract = mapBackendDryRunContract(fullInvoiceDryRunContext);
    const preflight = runBackendTriggerPreflight(
      contract,
      parseBackendSmokeReadinessConfig(readyConfig),
      fullInvoiceDryRunContext,
      smokeTargetEnv,
    );

    expect(preflight.liveSmokeTarget.actualBitrixDealId).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(preflight.request.payload.bitrix_deal_id).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(preflight.liveSmokeTarget.testDealLabelStartsWithTestPrefix).toBe(true);
    expect(preflight.liveSmokeTarget.manualCrmPreparationConfirmed).toBe(false);
    expect(preflight.execution.requestSent).toBe(false);
    expect(preflight.execution.endpointCalled).toBe(false);
    expect(preflight.execution.workflowExecuted).toBe(false);
    expect(preflight.execution.dbWriteExecuted).toBe(false);
  });

  it('generated report passes strict JSON and Markdown assertions', async () => {
    const scenarioResult = await executeDryRunScenarioWithEnv();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, fullInvoiceScenario.safetyContext),
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      finishedAt: new Date('2026-05-26T12:00:01.000Z'),
      reportWritten: true,
      smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
    });
    const markdown = buildLiveTestReportMarkdown(report);

    expect(report.backendTriggerPreflight.liveSmokeTarget.actualBitrixDealId).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(report.backendTriggerPreflight.request.bitrix_deal_id).toBe(
      LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID,
    );
    expect(report.productionReadiness).toBe('NOT_READY');
    expect(report.runnerDirectExternalSideEffectsExecuted).toBe(false);

    expect(() => assertDryRunReport(report, 'full')).not.toThrow();
    expect(() => assertDryRunMarkdown(markdown, 'full', report)).not.toThrow();
  });

  it('negative Markdown leak probe fails when arbitrary 28392 is appended', async () => {
    const scenarioResult = await executeDryRunScenarioWithEnv();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, fullInvoiceScenario.safetyContext),
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      finishedAt: new Date('2026-05-26T12:00:01.000Z'),
      reportWritten: true,
      smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
    });
    const markdown = `${buildLiveTestReportMarkdown(report)}\nArbitrary leaked real-data marker: ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID}`;

    expect(() => assertDryRunMarkdown(markdown, 'full', report)).toThrow(
      DryRunReportAssertionError,
    );
    expect(() => assertDryRunMarkdown(markdown, 'full', report)).toThrow(
      /unapproved Markdown context/,
    );
  });

  it('rejects example deal id leaked into JSON summary text', async () => {
    const scenarioResult = await executeDryRunScenarioWithEnv();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, fullInvoiceScenario.safetyContext),
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      finishedAt: new Date('2026-05-26T12:00:01.000Z'),
      reportWritten: true,
      smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
    });

    const leaked: LiveTestReport = {
      ...report,
      summary: `Deal ${LIVE_TEST_EXAMPLE_BITRIX_DEAL_ID} prepared for smoke`,
    };

    expect(() => assertBitrixDealIdOnlyInApprovedReportFields(leaked)).toThrow(
      /outside approved report fields/,
    );
    expect(() => assertDryRunReport(leaked, 'full')).toThrow(DryRunReportAssertionError);
  });

  it('fails Markdown assertion when backend auth secret appears', async () => {
    const scenarioResult = await executeDryRunScenarioWithEnv();
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult,
      safetyChecks: collectSafetyChecks(validEnv, fullInvoiceScenario.safetyContext),
      startedAt: new Date('2026-05-26T12:00:00.000Z'),
      finishedAt: new Date('2026-05-26T12:00:01.000Z'),
      reportWritten: true,
      smokeReadinessConfig: parseBackendSmokeReadinessConfig(readyConfig),
    });
    const markdown = `${buildLiveTestReportMarkdown(report)}\nsecret=${readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET}`;

    process.env.LIVE_TEST_BACKEND_AUTH_SECRET =
      readyConfig.LIVE_TEST_BACKEND_AUTH_SECRET;

    expect(() => assertDryRunMarkdown(markdown, 'full', report)).toThrow(
      /auth secret/i,
    );
  });
});

async function executeDryRunScenarioWithEnv() {
  return executeDryRunScenario({
    context: fullInvoiceDryRunContext,
    availabilityConfig: { healthPath: '/health', timeoutMs: 5000 },
    triggerPreflightConfig: parseBackendSmokeReadinessConfig(readyConfig),
    triggerPreflightEnv: process.env,
    fetchImpl: jest.fn(),
  });
}
