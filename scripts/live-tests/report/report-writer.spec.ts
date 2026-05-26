import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { DRY_RUN_STEP_NAMES } from '../execution/dry-run-steps';
import { buildLiveTestReport } from './build-live-test-report';
import { writeLiveTestReport } from './report-writer';
import { liveTestReportSchema } from '../types/live-test-report.types';
import { fullInvoiceScenario } from '../scenarios/full-invoice.scenario';
import { advanceInvoiceScenario } from '../scenarios/advance-invoice.scenario';
import { finalInvoiceScenario } from '../scenarios/final-invoice.scenario';
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

const scenarios = [fullInvoiceScenario, advanceInvoiceScenario, finalInvoiceScenario];

describe('writeLiveTestReport', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'live-test-report-'));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it.each(scenarios)(
    'writes dry-run report for $id with required fixed statuses',
    async (scenario) => {
      const startedAt = new Date('2026-05-26T10:00:00.000Z');
      const finishedAt = new Date('2026-05-26T10:00:01.000Z');
      const safetyChecks = collectSafetyChecks(validEnv, scenario.safetyContext);
      const scenarioResult = await scenario.run();
      const report = buildLiveTestReport({
        scenario,
        scenarioResult,
        safetyChecks,
        startedAt,
        finishedAt,
        reportWritten: true,
      });

      const paths = await writeLiveTestReport(report, {
        outputDir,
        timestamp: finishedAt,
      });

      const jsonContent = await readFile(paths.jsonPath, 'utf8');
      const markdownContent = await readFile(paths.markdownPath, 'utf8');
      const parsed = liveTestReportSchema.parse(JSON.parse(jsonContent));

      expect(parsed.productionReadiness).toBe('NOT_READY');
      expect(parsed.ksefStatus).toBe('MANUAL_REQUIRED');
      expect(parsed.bitrixSyncStatus).toBe('NOT_TESTED_YET');
      expect(parsed.externalSideEffectsExecuted).toBe(false);
      expect(parsed.integrations.ksef).toBe('MANUAL_REQUIRED');
      expect(parsed.integrations.bitrixSync).toBe('NOT_TESTED_YET');
      expect(parsed.scenario.status).toBe('DRY_RUN_COMPLETED');
      expect(parsed.meta.executionMode).toBe('dry-run');

      const stepNames = parsed.scenario.steps.map((step) => step.name);
      expect(stepNames).toContain(DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP);
      expect(stepNames).toContain(DRY_RUN_STEP_NAMES.WRITE_REPORT);
      expect(
        parsed.scenario.steps.find(
          (step) => step.name === DRY_RUN_STEP_NAMES.SIMULATE_BITRIX_DEAL_SETUP,
        )?.status,
      ).toBe('SKIPPED_NOT_EXECUTED');
      expect(
        parsed.scenario.steps.find(
          (step) => step.name === DRY_RUN_STEP_NAMES.WRITE_REPORT,
        )?.status,
      ).toBe('PASSED');

      expect(markdownContent).toContain('NOT_READY');
      expect(markdownContent).toContain('MANUAL_REQUIRED');
      expect(markdownContent).toContain('NOT_TESTED_YET');
      expect(markdownContent).toContain('External side effects executed: **false**');

      expect(jsonContent).not.toMatch(/API_TOKEN|WEBHOOK_URL|password/i);
      expect(markdownContent).not.toMatch(/API_TOKEN|WEBHOOK_URL|password/i);
    },
  );
});
