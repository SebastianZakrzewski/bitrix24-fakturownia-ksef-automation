import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildLiveTestReport } from './build-live-test-report';
import { writeLiveTestReport } from './report-writer';
import { liveTestReportSchema } from '../types/live-test-report.types';
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

describe('writeLiveTestReport', () => {
  let outputDir: string;

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'live-test-report-'));
  });

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true });
  });

  it('writes JSON and Markdown with fixed V1 skeleton statuses', async () => {
    const startedAt = new Date('2026-05-26T10:00:00.000Z');
    const finishedAt = new Date('2026-05-26T10:00:01.000Z');
    const safetyChecks = collectSafetyChecks(
      validEnv,
      fullInvoiceScenario.safetyContext,
    );
    const report = buildLiveTestReport({
      scenario: fullInvoiceScenario,
      scenarioResult: await fullInvoiceScenario.run(),
      safetyChecks,
      startedAt,
      finishedAt,
    });

    const paths = await writeLiveTestReport(report, {
      outputDir,
      timestamp: finishedAt,
    });

    const jsonContent = await readFile(paths.jsonPath, 'utf8');
    const markdownContent = await readFile(paths.markdownPath, 'utf8');
    const parsed = liveTestReportSchema.parse(JSON.parse(jsonContent));

    expect(parsed.productionReadiness).toBe('NOT_READY');
    expect(parsed.integrations.ksef).toBe('MANUAL_REQUIRED');
    expect(parsed.integrations.bitrixSync).toBe('NOT_TESTED_YET');
    expect(parsed.scenario.status).toBe('PLACEHOLDER_SKIPPED');

    expect(markdownContent).toContain('NOT_READY');
    expect(markdownContent).toContain('MANUAL_REQUIRED');
    expect(markdownContent).toContain('NOT_TESTED_YET');

    expect(jsonContent).not.toMatch(/API_TOKEN|WEBHOOK_URL|password/i);
    expect(markdownContent).not.toMatch(/API_TOKEN|WEBHOOK_URL|password/i);
  });
});
